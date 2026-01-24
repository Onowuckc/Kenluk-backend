const FidelityPaymentService = require('../services/fidelityPaymentService');
const FidelityPayment = require('../models/FidelityPayment');
const { generateRequestRef } = require('../utils/fidelityEncryption');

/**
 * Initialize a payment collection request
 * POST /api/payments/fidelity/initialize
 */
exports.initializePayment = async (req, res) => {
    try {
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
            paymentMethod = 'bank_account',
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

        const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const customerRef = `CUST-${userId}-${Date.now()}`;
        const requestRef = generateRequestRef();

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
                phone: customerMobile,
                customerRef
            },
            paymentMethod,
            status: 'Pending',
            metadata: new Map(Object.entries(metadata)),
            initiatedAt: new Date()
        });

        // Save to database
        await fidelityPayment.save();

        // Call Fidelity API
        const paymentResponse = await FidelityPaymentService.processPayment({
            amount,
            customerEmail,
            customerFirstName,
            customerLastName,
            customerMobile,
            customerRef,
            transactionDesc: description,
            transactionRef,
            authProvider: 'Fidelity',
            mockMode: process.env.NODE_ENV === 'production' ? 'live' : 'inspect'
        });

        if (paymentResponse.success) {
            const responseData = paymentResponse.data.data || {};

            // Update payment record with API response
            fidelityPayment.fidelityResponse = {
                statusFromAPI: paymentResponse.data.status,
                message: paymentResponse.data.message,
                providerResponseCode: responseData.provider_response_code,
                provider: responseData.provider,
                chargeToken: responseData.charge_token,
                errors: responseData.errors || []
            };
            fidelityPayment.status = paymentResponse.data.status;

            await fidelityPayment.save();

            return res.status(200).json({
                success: true,
                message: 'Payment initialized successfully',
                data: {
                    paymentId: fidelityPayment._id,
                    transactionRef,
                    requestRef,
                    chargeToken: responseData.charge_token,
                    status: paymentResponse.data.status,
                    amount,
                    message: paymentResponse.data.message,
                    paymentOptions: responseData.paymentoptions || []
                }
            });
        } else {
            // Update payment record with error
            fidelityPayment.status = 'Failed';
            fidelityPayment.fidelityResponse = {
                statusFromAPI: 'Failed',
                message: paymentResponse.error?.message || 'Payment initialization failed',
                mainError: JSON.stringify(paymentResponse.error)
            };

            await fidelityPayment.save();

            return res.status(paymentResponse.statusCode).json({
                success: false,
                message: 'Failed to initialize payment',
                error: paymentResponse.error,
                paymentId: fidelityPayment._id
            });
        }
    } catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Error initializing payment',
            error: error.message
        });
    }
};

/**
 * Query payment status
 * GET /api/payments/fidelity/:transactionRef/status
 */
exports.getPaymentStatus = async (req, res) => {
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
exports.getPaymentHistory = async (req, res) => {
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
exports.handleWebhook = async (req, res) => {
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
exports.retryPayment = async (req, res) => {
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

        // Retry payment
        const paymentResponse = await FidelityPaymentService.processPayment({
            amount: payment.amount,
            customerEmail: payment.customer.email,
            customerFirstName: payment.customer.firstName,
            customerLastName: payment.customer.lastName,
            customerMobile: payment.customer.phone,
            customerRef: payment.customer.customerRef,
            transactionDesc: payment.description,
            transactionRef: payment.transactionRef,
            authProvider: 'Fidelity',
            mockMode: process.env.NODE_ENV === 'production' ? 'live' : 'inspect'
        });

        if (paymentResponse.success) {
            const responseData = paymentResponse.data.data || {};

            payment.fidelityResponse = {
                statusFromAPI: paymentResponse.data.status,
                message: paymentResponse.data.message,
                providerResponseCode: responseData.provider_response_code,
                provider: responseData.provider,
                chargeToken: responseData.charge_token,
                errors: responseData.errors || []
            };
            payment.status = paymentResponse.data.status;

            await payment.save();

            return res.status(200).json({
                success: true,
                message: 'Payment retry successful',
                data: {
                    paymentId: payment._id,
                    transactionRef: payment.transactionRef,
                    status: payment.status,
                    retryCount: payment.retryCount
                }
            });
        } else {
            return res.status(paymentResponse.statusCode).json({
                success: false,
                message: 'Payment retry failed',
                error: paymentResponse.error
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

module.exports = exports;
