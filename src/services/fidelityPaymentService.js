import axios from 'axios';
import * as fidelityEncryption from '../utils/fidelityEncryption.js';

const FIDELITY_API_URL = process.env.FIDELITY_API_URL || 'https://api.paygateplus.ng';
const FIDELITY_API_KEY = process.env.FIDELITY_API_KEY;
const FIDELITY_API_SECRET = process.env.FIDELITY_WEBHOOK_SECRET;

class FidelityPaymentService {
    /**
     * Create headers for PaygatePlus API request
     * @param {string} requestRef - Unique request reference
     * @returns {object} Headers object
     */
    static createHeaders(requestRef) {
        if (!FIDELITY_API_KEY || !FIDELITY_API_SECRET) {
            throw new Error('PaygatePlus API credentials not configured');
        }

        // PaygatePlus signature: md5(request_ref + secret)
        const signature = fidelityEncryption.generatePaygateSignature(requestRef, FIDELITY_API_SECRET);

        return {
            'Authorization': `Bearer ${FIDELITY_API_KEY}`,
            'Signature': signature,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Create virtual account for wallet funding using PaygatePlus Open Account API
     * @param {object} paymentData - Payment details
     * @returns {Promise<object>} Response from PayGate Plus API
     */
    static async createVirtualAccount(paymentData) {
        try {
            const {
                amount,
                customerEmail,
                customerFirstName,
                customerLastName,
                customerMobile,
                transactionRef,
                metadata = {}
            } = paymentData;

            // Validate required fields
            if (!amount || !customerEmail || !customerFirstName || !customerLastName ||
                !customerMobile || !transactionRef) {
                throw new Error('Missing required payment fields');
            }

            // Validate amount
            if (amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerEmail)) {
                throw new Error('Invalid customer email format');
            }

            // Validate Nigerian phone number (should start with 234)
            const phoneRegex = /^234[0-9]{10}$/;
            const cleanPhone = customerMobile.replace(/\s+/g, '').replace(/^\+/, '');
            if (!phoneRegex.test(cleanPhone)) {
                throw new Error('Mobile number must start with 234 and be 13 digits');
            }

            const requestRef = fidelityEncryption.generateRequestRef();

            // PaygatePlus API payload structure for open_account (EXACT format required)
            const requestBody = {
                request_ref: requestRef,
                request_type: "open_account",
                auth: {
                    type: "null",
                    secure: null, // Will be set if encryption is needed
                    auth_provider: "FidelityVirtual"
                },
                transaction: {
                    mock_mode: process.env.NODE_ENV === 'production' ? 'Live' : 'Live', // Always Live for production
                    transaction_ref: transactionRef,
                    transaction_desc: metadata.description || 'Wallet funding',
                    transaction_ref_parent: "",
                    amount: amount, // Amount already in kobo from controller
                    customer: {
                        customer_ref: cleanPhone,
                        firstname: customerFirstName,
                        surname: customerLastName,
                        email: customerEmail,
                        mobile_no: cleanPhone
                    },
                    meta: {
                        send_email: true,
                        currency: "NGN"
                    },
                    details: {
                        page_slug: "bank_account"
                    }
                }
            };

            // PaygatePlus headers (EXACT format required)
            const headers = this.createHeaders(requestRef);

            const response = await axios.post(
                `${FIDELITY_API_URL}/v2/transact`,
                requestBody,
                { headers, timeout: 30000 }
            );

            return {
                success: response.status === 200 || response.status === 201,
                statusCode: response.status,
                data: response.data,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                statusCode: error.response?.status || 500,
                error: error.response?.data || error.message,
                timestamp: new Date().toISOString()
            };
        }
    }



    /**
     * Query payment status
     * @param {string} transactionRef - Transaction reference
     * @param {string} mockMode - Test mode ('inspect') or live ('live')
     * @returns {Promise<object>} Response from Fidelity API
     */
    static async queryPaymentStatus(transactionRef, mockMode = 'inspect') {
        try {
            const requestRef = fidelityEncryption.generateRequestRef();

            const requestBody = {
                request_ref: requestRef,
                request_type: 'query_transaction',
                transaction: {
                    transaction_ref: transactionRef,
                    mock_mode: mockMode
                }
            };

            const headers = this.createHeaders(requestRef);

            const response = await axios.post(
                `${FIDELITY_API_URL}/transactions/query`,
                requestBody,
                { headers, timeout: 30000 }
            );

            return {
                success: response.status === 200,
                statusCode: response.status,
                data: response.data,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                statusCode: error.response?.status || 500,
                error: error.response?.data || error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Handle Fidelity webhook notification
     * @param {object} webhookData - Data from webhook
     * @returns {object} Processed webhook data
     */
    static processWebhookData(webhookData) {
        try {
            const data = webhookData?.data || {};
            const details = webhookData?.details || {};
            const detailsData = details?.data || {};
            const transaction = webhookData?.transaction || data?.transaction || details || {};

            let requestRef = webhookData?.request_ref || webhookData?.requestRef || data?.request_ref;
            let status = webhookData?.status || data?.status || details?.status;
            const message = webhookData?.message || data?.message || detailsData?.statusmessage;
            const requestType = webhookData?.request_type || data?.request_type || details?.request_type;

            if (!requestRef && (transaction?.transaction_ref || details?.transaction_ref)) {
                requestRef = transaction.transaction_ref || details.transaction_ref;
            }

            // Normalize status for transaction_notification payloads
            if (!status && requestType === 'transaction_notification' && (data?.error === null || data?.error === undefined)) {
                status = 'Successful';
            }

            if (!status && typeof message === 'string' && /successful/i.test(message)) {
                status = 'Successful';
            }

            // If we still don't have required fields, return a default structure instead of throwing
            if (!requestRef || !status) {
                console.warn('Webhook data missing required fields, using defaults:', {
                    hasRequestRef: Boolean(requestRef),
                    hasStatus: Boolean(status),
                    requestType,
                    topLevelKeys: Object.keys(webhookData || {}),
                    dataKeys: Object.keys(data || {}),
                    transactionKeys: Object.keys(transaction || {})
                });

                return {
                    requestRef: requestRef || 'unknown',
                    status: status || 'Unknown',
                    message: message || 'Webhook data incomplete',
                  transactionRef: transaction?.transaction_ref || details?.transaction_ref,
                  accountReference: transaction?.account_reference || data?.account_reference || data?.account_ref || detailsData?.paymentreference,
                  amount: transaction?.amount || details?.amount,
                  customerRef: transaction?.customer?.customer_ref || details?.customer_ref,
                    providerResponseCode: data?.provider_response_code,
                    errors: data?.errors || ['Invalid webhook data structure'],
                    chargeToken: data?.charge_token,
                    processedAt: new Date().toISOString(),
                    isValid: false // Flag to indicate invalid data
                };
            }

            return {
                requestRef: requestRef,
                status: status, // Successful, Failed, Processing, WaitingForOTP, etc.
                message: message,
                transactionRef: transaction?.transaction_ref || details?.transaction_ref,
                accountReference: transaction?.account_reference || data?.account_reference || data?.account_ref || detailsData?.paymentreference,
                amount: transaction?.amount || details?.amount,
                customerRef: transaction?.customer?.customer_ref || details?.customer_ref,
                providerResponseCode: data?.provider_response_code,
                errors: data?.errors || [],
                chargeToken: data?.charge_token,
                processedAt: new Date().toISOString(),
                isValid: true // Flag to indicate valid data
            };
        } catch (error) {
            console.error('Webhook processing error:', error.message);
            // Return a safe default instead of throwing
            return {
                requestRef: 'error',
                status: 'Error',
                message: `Webhook processing failed: ${error.message}`,
                transactionRef: null,
                accountReference: null,
                amount: null,
                customerRef: null,
                providerResponseCode: null,
                errors: [error.message],
                chargeToken: null,
                processedAt: new Date().toISOString(),
                isValid: false
            };
        }
    }

    /**
     * Validate webhook signature (if needed)
     * @param {string} signature - Signature from webhook header
     * @param {object} payload - Webhook payload
     * @returns {boolean} True if signature is valid
     */
    static validateWebhookSignature(signature, payload) {
        try {
            // For webhook validation, use the same signature format as sendInvoice
            // Note: Webhook signature validation may need adjustment based on PaygatePlus docs
            const expectedSignature = fidelityEncryption.generateSignature(
                payload.request_ref,
                payload.amount || 0,
                payload.currency || 'NGN',
                payload.redirect_url || '',
                FIDELITY_API_SECRET
            );

            return signature === expectedSignature;
        } catch (error) {
            return false;
        }
    }
}

export { FidelityPaymentService };
export default FidelityPaymentService;
