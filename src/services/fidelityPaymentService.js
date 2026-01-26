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
    static createHeaders(requestRef) {
        if (!FIDELITY_API_KEY || !FIDELITY_API_SECRET) {
            throw new Error('Fidelity API credentials not configured');
        }

        const signature = fidelityEncryption.generateSignature(requestRef, FIDELITY_API_SECRET);

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIDELITY_API_KEY}`,
            'Signature': signature,
            'request-ref': requestRef
        };
    }

    /**
     * Process a payment collection request
     * @param {object} paymentData - Payment details
     * @returns {Promise<object>} Response from Fidelity API
     */
    static async processPayment(paymentData) {
        try {
            const {
                amount,
                customerEmail,
                customerFirstName,
                customerLastName,
                customerMobile,
                customerRef,
                transactionDesc,
                transactionRef,
                authProvider = 'Fidelity',
                mockMode = 'inspect' // 'inspect' for test, 'live' for production
            } = paymentData;

            // Validate required fields
            if (!amount || !customerEmail || !customerFirstName || !customerLastName || 
                !customerMobile || !customerRef || !transactionDesc || !transactionRef) {
                throw new Error('Missing required payment fields');
            }

            const requestRef = fidelityEncryption.generateRequestRef();

            const requestBody = {
                request_ref: requestRef,
                request_type: 'collect',
                auth: {
                    type: 'bank.account',
                    auth_provider: authProvider
                },
                transaction: {
                    amount: Math.floor(amount * 100), // Convert to kobo
                    transaction_ref: transactionRef,
                    transaction_desc: transactionDesc,
                    customer: {
                        customer_ref: customerRef,
                        firstname: customerFirstName,
                        surname: customerLastName,
                        email: customerEmail,
                        mobile_no: customerMobile
                    },
                    mock_mode: mockMode,
                    meta: {
                        app: 'kenluk-payment',
                        timestamp: new Date().toISOString()
                    }
                }
            };

            const headers = this.createHeaders(requestRef);

            const response = await axios.post(
                `${FIDELITY_API_URL}/transactions/collect`,
                requestBody,
                { headers, timeout: 30000 }
            );

            return {
                success: response.status === 200,
                statusCode: response.status,
                data: response.data,
                requestRef,
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
            const payloadString = JSON.stringify(payload);
            const expectedSignature = fidelityEncryption.generateSignature(
                payload.request_ref,
                FIDELITY_API_SECRET
            );

            return signature === expectedSignature;
        } catch (error) {
            return false;
        }
    }
}

export default FidelityPaymentService;
