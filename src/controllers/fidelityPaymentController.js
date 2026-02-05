import FidelityPaymentService from '../services/fidelityPaymentService.js';
import FidelityPayment from '../models/FidelityPayment.js';
import * as fidelityEncryption from '../utils/fidelityEncryption.js';

/**
 * Send an invoice for payment collection
 * POST /api/payments/fidelity/send-invoice
 */
export const sendInvoice = async (req, res) => {
    try {
        console.log('sendInvoice endpoint hit with payload:', req.body);
        const userId = req.user?.id || req.body.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const {
            amount,
            description,
            customerFirstName,
            customerLastName,
            customerEmail,
            customerMobile,
            metadata = {}
        } = req.body;

        // Validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        if (!customerFirstName || !customerLastName || !customerEmail || !customerMobile) {
            return res.status(400).json({
                success: false,
                message: 'Customer information is required'
            });
        }

        const transactionRef = `KNL-WALLET-${Date.now()}`;
        const requestRef = fidelityEncryption.generateRequestRef();
        const callbackUrl = `${process.env.BASE_URL || 'https://kenluk-backend-production.up.railway.app'}/api/payments/fidelity/webhook`;
        const redirectUrl = req.body.redirectUrl || callbackUrl; // Frontend redirect URL

        // Create payment record in database
        const fidelityPayment = new FidelityPayment({
            transactionRef,
            requestRef,
            userId,
            amount,
            currency: 'NGN',
            description,
            customer: {
                firstName: customerFirstName,
                lastName: customerLastName,
                email: customerEmail,
                phone: customerMobile
            },
            status: 'Pending',
            metadata: metadata,
            initiatedAt: new Date()
        });

        // Save to database
        await fidelityPayment.save();

        // Call PayGate Plus API to send invoice
        const invoiceResponse = await FidelityPaymentService.sendInvoice({
            amount: Math.round(amount * 100), // Convert Naira to kobo
            customerEmail,
            customerFirstName,
            customerLastName,
            customerMobile,
            transactionRef,
            callbackUrl,
            redirectUrl,
            metadata
        });

        if (invoiceResponse.success) {
            const responseData = invoiceResponse.data;

            // Extract payment URL from response
            const paymentUrl = responseData?.payment_url || responseData?.data?.payment_url;

            // Update payment record with API response
            fidelityPayment.fidelityResponse = {
                statusFromAPI: 'success',
                message: 'Invoice sent successfully',
                paymentUrl: paymentUrl,
                transactionRef: responseData.transaction_ref
            };
            fidelityPayment.status = 'InvoiceSent';

            await fidelityPayment.save();

            return res.status(200).json({
                success: true,
                message: 'Invoice sent successfully',
                data: {
                    paymentId: fidelityPayment._id,
                    transactionRef,
                    paymentUrl: paymentUrl,
                    status: 'InvoiceSent',
                    amount,
                    message: 'Redirect user to payment URL to complete payment'
                }
            });
        } else {
            // Update payment record with error
            fidelityPayment.status = 'Failed';
            fidelityPayment.fidelityResponse = {
                statusFromAPI: 'Failed',
                message: invoiceResponse.error?.message || 'Invoice sending failed',
                mainError: JSON.stringify(invoiceResponse.error)
            };

            await fidelityPayment.save();

            console.error('Invoice sending failed:', invoiceResponse.error);

            return res.status(invoiceResponse.statusCode).json({
                success: false,
                message: 'Failed to send invoice',
                error: invoiceResponse.error,
                paymentId: fidelityPayment._id
            });
        }
    } catch (error) {
        console.error('Invoice sending error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending invoice',
            error: error.message
        });
    }
};

/**
 * Query payment status
 * GET /api/payments/fidelity/:transactionRef/status
 */
export const getPaymentStatus = async (req, res) => {
    try {
        const { transactionRef } = req.params;
        const userId = req.user?.id;

        // Find payment record
        const payment = await FidelityPayment.findOne({
            transactionRef,
            userId
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Query Fidelity API for latest status
        const statusResponse = await FidelityPaymentService.queryPaymentStatus(
            transactionRef,
            process.env.NODE_ENV === 'production' ? 'live' : 'inspect'
        );

        if (statusResponse.success && statusResponse.data.data) {
            const responseData = statusResponse.data.data;

            // Update payment record with latest status
            payment.fidelityResponse = {
                statusFromAPI: statusResponse.data.status,
                message: statusResponse.data.message,
                providerResponseCode: responseData.provider_response_code,
                provider: responseData.provider,
                errors: responseData.errors || []
            };
            payment.status = statusResponse.data.status;

            await payment.save();
        }

        return res.status(200).json({
            success: true,
            data: {
                paymentId: payment._id,
                transactionRef: payment.transactionRef,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                description: payment.description,
                customer: payment.customer,
                message: payment.fidelityResponse?.message,
                completedAt: payment.completedAt,
                failureReason: payment.fidelityResponse?.mainError
            }
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment status',
            error: error.message
        });
    }
};

/**
 * Get payment history for user
 * GET /api/payments/fidelity/history
 */
export const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { status, page = 1, limit = 10 } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const skip = (page - 1) * limit;
        const query = { userId };

        if (status) {
            query.status = status;
        }

        const payments = await FidelityPayment.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await FidelityPayment.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: {
                payments: payments.map(p => ({
                    paymentId: p._id,
                    transactionRef: p.transactionRef,
                    status: p.status,
                    amount: p.amount,
                    currency: p.currency,
                    description: p.description,
                    createdAt: p.createdAt,
                    completedAt: p.completedAt
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment history',
            error: error.message
        });
    }
};

/**
 * Handle webhook notification from Fidelity
 * POST /api/payments/fidelity/webhook
 */
export const handleWebhook = async (req, res) => {
    try {
        const webhookData = req.body;
        const signature = req.headers['x-fidelity-signature'];

        // Validate webhook (optional but recommended)
        // const isValid = FidelityPaymentService.validateWebhookSignature(signature, webhookData);
        // if (!isValid) {
        //     return res.status(401).json({
        //         success: false,
        //         message: 'Invalid webhook signature'
        //     });
        // }

        // Process webhook data
        const processedData = FidelityPaymentService.processWebhookData(webhookData);

        // Find payment record
        const payment = await FidelityPayment.findOne({
            transactionRef: processedData.transactionRef
        });

        if (!payment) {
            console.warn(`Webhook received for unknown transaction: ${processedData.transactionRef}`);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Update payment record
        await payment.updateFromWebhook({
            statusFromAPI: processedData.status,
            message: processedData.message,
            providerResponseCode: processedData.providerResponseCode,
            provider: processedData.provider,
            chargeToken: processedData.chargeToken,
            errors: processedData.errors
        });

        console.log(`Payment ${payment.transactionRef} updated to status: ${processedData.status}`);

        return res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            data: {
                transactionRef: payment.transactionRef,
                status: payment.status
            }
        });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing webhook',
            error: error.message
        });
    }
};

/**
 * Retry payment
 * POST /api/payments/fidelity/:paymentId/retry
 */
export const retryPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user?.id;

        const payment = await FidelityPayment.findOne({
            _id: paymentId,
            userId
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.status === 'Successful') {
            return res.status(400).json({
                success: false,
                message: 'Cannot retry a successful payment'
            });
        }

        // Increment retry count
        payment.retryCount += 1;
        payment.lastRetryAt = new Date();
        payment.status = 'Pending';

        await payment.save();

        // Retry invoice sending
        const paymentMethod = req.body.paymentMethod || 'bank_account'; // Default to bank_account

        const invoiceResponse = await FidelityPaymentService.sendInvoice({
            amount: payment.amount,
            customerEmail: payment.customer.email,
            customerFirstName: payment.customer.firstName,
            customerLastName: payment.customer.lastName,
            customerMobile: payment.customer.phone,
            transactionRef: payment.transactionRef,
            paymentMethod,
            metadata: payment.metadata
        });

        if (invoiceResponse.success) {
            const responseData = invoiceResponse.data;

            payment.fidelityResponse = {
                statusFromAPI: 'success',
                message: 'Invoice resent successfully',
                paymentUrl: responseData.payment_url,
                transactionRef: responseData.transaction_ref
            };
            payment.status = 'InvoiceSent';

            await payment.save();

            return res.status(200).json({
                success: true,
                message: 'Invoice retry successful',
                data: {
                    paymentId: payment._id,
                    transactionRef: payment.transactionRef,
                    paymentUrl: responseData.payment_url,
                    status: 'InvoiceSent',
                    retryCount: payment.retryCount
                }
            });
        } else {
            return res.status(invoiceResponse.statusCode).json({
                success: false,
                message: 'Invoice retry failed',
                error: invoiceResponse.error
            });
        }
    } catch (error) {
        console.error('Payment retry error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrying payment',
            error: error.message
        });
    }
};

export default {
  sendInvoice,
  getPaymentStatus,
  getPaymentHistory,
  handleWebhook,
  retryPayment
};
