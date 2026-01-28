import axios from 'axios';
import * as fidelityEncryption from '../utils/fidelityEncryption.js';

const FIDELITY_API_URL = process.env.FIDELITY_API_URL || 'https://api.paygateplus.ng';
const FIDELITY_API_KEY = process.env.FIDELITY_API_KEY;
const FIDELITY_API_SECRET = process.env.FIDELITY_WEBHOOK_SECRET;

class FidelityPaymentService {
    /**
     * Create headers for Fidelity API request
     * @param {string} requestRef - Unique request reference
     * @returns {object} Headers object
     */
    static createHeaders(requestRef, amount, currency, redirectUrl) {
        if (!FIDELITY_API_KEY || !FIDELITY_API_SECRET) {
            throw new Error('Fidelity API credentials not configured');
        }

        const signature = fidelityEncryption.generateSignature(requestRef, amount, currency, redirectUrl, FIDELITY_API_SECRET);

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIDELITY_API_KEY}`,
            'Signature': signature,
            'request-ref': requestRef
        };
    }

    /**
     * Send invoice for payment collection using PaygatePlus Send Invoice API
     * @param {object} paymentData - Payment details
     * @returns {Promise<object>} Response from PayGate Plus API
     */
    static async sendInvoice(paymentData) {
        try {
            const {
                amount,
                customerEmail,
                customerFirstName,
                customerLastName,
                customerMobile,
                transactionRef,
                callbackUrl,
                redirectUrl,
                metadata = {}
            } = paymentData;

            // Validate required fields
            if (!amount || !customerEmail || !customerFirstName || !customerLastName ||
                !customerMobile || !transactionRef || !callbackUrl) {
                throw new Error('Missing required payment fields');
            }

            // Validate amount
            if (amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Ensure amount is integer (in kobo)
            if (!Number.isInteger(amount)) {
                throw new Error('Amount must be an integer (in kobo)');
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

            // PaygatePlus Send Invoice API payload structure
            const requestBody = {
                request_ref: requestRef,
                amount: Math.floor(amount * 100), // Convert to kobo
                currency: 'NGN',
                description: metadata.description || 'Wallet funding',
                customer: {
                    name: `${customerFirstName} ${customerLastName}`,
                    email: customerEmail,
                    phone: cleanPhone // Use cleaned phone number
                },
                payment_methods: [
                    'bank_account',
                    'card',
                    'mobile_money'
                ],
                callback_url: callbackUrl,
                redirect_url: redirectUrl || callbackUrl,
                meta: {
                    app: 'kenluk-payment',
                    purpose: 'wallet_funding',
                    transaction_ref: transactionRef,
                    ...metadata
                }
            };

            // PaygatePlus Send Invoice API headers
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIDELITY_API_KEY}`,
                'Signature': fidelityEncryption.generateSignature(requestRef, FIDELITY_API_SECRET),
                'request-ref': requestRef
            };

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

            const headers = this.createHeaders(requestRef, amount, 'NGN', redirectUrl);

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
            const {
                request_ref,
                status,
                message,
                data,
                transaction
            } = webhookData;

            // Validate webhook
            if (!request_ref || !status) {
                throw new Error('Invalid webhook data');
            }

            return {
                requestRef: request_ref,
                status: status, // Successful, Failed, Processing, WaitingForOTP, etc.
                message: message,
                transactionRef: transaction?.transaction_ref,
                amount: transaction?.amount,
                customerRef: transaction?.customer?.customer_ref,
                providerResponseCode: data?.provider_response_code,
                errors: data?.errors || [],
                chargeToken: data?.charge_token,
                processedAt: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Webhook processing failed: ${error.message}`);
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
