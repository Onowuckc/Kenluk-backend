import FidelityPaymentService from '../services/fidelityPaymentService.js';
import FidelityPayment from '../models/FidelityPayment.js';
import * as fidelityEncryption from '../utils/fidelityEncryption.js';

/**
 * Create virtual account for wallet funding
 * POST /api/payments/fidelity/create-virtual-account
 */
export const createVirtualAccount = async (req, res) => {
    let fidelityPayment;
    try {
        console.log('createVirtualAccount endpoint hit with payload:', req.body);
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

        // Enforce one active virtual account per user (only block truly active accounts)
        const activeVirtualAccount = await FidelityPayment.findOne({
            userId,
            status: 'WAITING_FOR_TRANSFER'
        });

        if (activeVirtualAccount) {
            if (!activeVirtualAccount.virtualAccount?.accountNumber) {
                // Stale or failed record without account details, mark failed and allow new creation
                activeVirtualAccount.status = 'FAILED';
                activeVirtualAccount.virtualAccount = {
                    ...(activeVirtualAccount.virtualAccount || {}),
                    status: 'FAILED'
                };
                await activeVirtualAccount.save();
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'User already has an active virtual account. Please complete the existing transfer before creating a new one.',
                    existingAccount: {
                        paymentId: activeVirtualAccount._id,
                        accountNumber: activeVirtualAccount.virtualAccount?.accountNumber,
                        bankName: activeVirtualAccount.virtualAccount?.bankName,
                        status: activeVirtualAccount.status
                    }
                });
            }
        }

        const transactionRef = `KNL-WALLET-${Date.now()}`;
        const requestRef = fidelityEncryption.generateRequestRef();

        // Create payment record in database
        fidelityPayment = new FidelityPayment({
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
            status: 'INITIATED',
            metadata: metadata,
            initiatedAt: new Date()
        });

        // Save to database
        await fidelityPayment.save();

        // Call PayGate Plus API to create virtual account
        const virtualAccountResponse = await FidelityPaymentService.createVirtualAccount({
            amount: Math.round(amount * 100), // Convert Naira to kobo
            customerEmail,
            customerFirstName,
            customerLastName,
            customerMobile,
            transactionRef,
            metadata
        });

        if (virtualAccountResponse.success) {
            const responseData = virtualAccountResponse.data;

            // Extract virtual account details from response
            const providerResponse = responseData?.data?.provider_response;
            const virtualAccount = responseData?.virtual_account || responseData?.data?.virtual_account || providerResponse || responseData;

            if (!virtualAccount?.account_number) {
                fidelityPayment.status = 'FAILED';
                fidelityPayment.virtualAccount = {
                    bankName: virtualAccount?.bank_name,
                    accountNumber: virtualAccount?.account_number,
                    accountName: virtualAccount?.account_name,
                    reference: virtualAccount?.reference,
                    status: 'FAILED'
                };
                await fidelityPayment.save();
                throw new Error('Virtual account not returned by Fidelity');
            }

            // Update payment record with virtual account details
            fidelityPayment.fidelityResponse = {
                statusFromAPI: 'success',
                message: 'Virtual account created successfully',
                accountNumber: virtualAccount?.account_number,
                accountName: virtualAccount?.account_name,
                bankName: virtualAccount?.bank_name,
                accountReference: virtualAccount?.reference,
                transactionRef: responseData.transaction_ref
            };
            fidelityPayment.virtualAccount = {
                bankName: virtualAccount?.bank_name,
                accountNumber: virtualAccount?.account_number,
                accountName: virtualAccount?.account_name,
                reference: virtualAccount?.reference,
                status: virtualAccount?.status
            };
            fidelityPayment.status = 'WAITING_FOR_TRANSFER';

            await fidelityPayment.save();

            // Log account_reference ↔ userId mapping for tracking
            console.log(`Virtual Account Mapping - User: ${userId}, Account Reference: ${virtualAccount?.reference}, Account Number: ${virtualAccount?.account_number}, Bank: ${virtualAccount?.bank_name}`);

            return res.status(200).json({
                success: true,
                fundingType: "BANK_TRANSFER",
                paymentId: fidelityPayment._id,
                status: 'WAITING_FOR_TRANSFER',
                amount: fidelityPayment.amount,
                virtualAccount: {
                    bankName: virtualAccount?.bank_name || 'Fidelity Bank',
                    accountNumber: virtualAccount?.account_number,
                    accountName: virtualAccount?.account_name,
                    reference: virtualAccount?.reference
                },
                message: "Transfer funds to the account details provided"
            });
        } else {
            // Update payment record with error
            fidelityPayment.status = 'FAILED';
            fidelityPayment.virtualAccount = {
                ...(fidelityPayment.virtualAccount || {}),
                status: 'FAILED'
            };
            fidelityPayment.fidelityResponse = {
                statusFromAPI: 'Failed',
                message: virtualAccountResponse.error?.message || 'Virtual account creation failed',
                mainError: JSON.stringify(virtualAccountResponse.error)
            };

            await fidelityPayment.save();

            console.error('Virtual account creation failed:', virtualAccountResponse.error);

            return res.status(virtualAccountResponse.statusCode).json({
                success: false,
                message: 'Failed to create virtual account',
                error: virtualAccountResponse.error,
                paymentId: fidelityPayment._id
            });
        }
    } catch (error) {
        console.error('Virtual account creation error:', error);
        if (fidelityPayment && fidelityPayment.status !== 'COMPLETED') {
            try {
                fidelityPayment.status = 'FAILED';
                fidelityPayment.virtualAccount = {
                    ...(fidelityPayment.virtualAccount || {}),
                    status: 'FAILED'
                };
                await fidelityPayment.save();
            } catch (saveError) {
                console.error('Failed to mark payment as FAILED after error:', saveError);
            }
        }
        res.status(500).json({
            success: false,
            message: 'Error creating virtual account',
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
            const normalizedStatus =
                statusResponse.data.status === 'Successful' ? 'COMPLETED'
                    : statusResponse.data.status === 'Failed' ? 'FAILED'
                        : statusResponse.data.status;

            payment.status = normalizedStatus;

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
        const statusFromAPI = processedData.status;
        const isSuccessful = statusFromAPI === 'Successful' || statusFromAPI === 'successful';

        // Find payment record by account reference or transaction reference
        const payment = await FidelityPayment.findOne({
            $or: [
                { 'virtualAccount.reference': processedData.accountReference },
                { transactionRef: processedData.transactionRef },
                { requestRef: processedData.requestRef }
            ]
        });

        if (!payment) {
            console.warn(`Webhook received for unknown transaction: ${processedData.transactionRef || processedData.accountReference}`);
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Always record webhook payload
        payment.webhookReceived = true;
        payment.webhookData = webhookData;
        payment.webhookReceivedAt = new Date();

        if (!isSuccessful) {
            payment.status = 'FAILED';
            payment.fidelityResponse = {
                statusFromAPI: statusFromAPI,
                message: processedData.message,
                providerResponseCode: processedData.providerResponseCode,
                provider: processedData.provider,
                chargeToken: processedData.chargeToken,
                errors: processedData.errors
            };
            await payment.save();

            console.log(`Payment ${payment.transactionRef} updated to status: ${statusFromAPI}`);
            return res.status(200).json({
                success: true,
                message: 'Webhook processed (non-success status)',
                data: {
                    transactionRef: payment.transactionRef,
                    status: payment.status
                }
            });
        }

        if (payment.status === 'COMPLETED') {
            return res.status(200).json({
                success: true,
                message: 'Payment already completed',
                data: {
                    transactionRef: payment.transactionRef,
                    status: payment.status
                }
            });
        }

        if (payment.status !== 'WAITING_FOR_TRANSFER' && payment.status !== 'VIRTUAL_ACCOUNT_CREATED') {
            console.warn(`Payment ${payment.transactionRef} in unexpected status: ${payment.status}`);
        }

        // Update payment record for successful transfer
        payment.status = 'COMPLETED';
        payment.completedAt = new Date();
        payment.fidelityResponse = {
            statusFromAPI: statusFromAPI,
            message: processedData.message,
            providerResponseCode: processedData.providerResponseCode,
            provider: processedData.provider,
            chargeToken: processedData.chargeToken,
            errors: processedData.errors
        };
        await payment.save();

        // Credit wallet only after successful transfer confirmation
        const WalletService = (await import('../services/walletService.js')).default;
        await WalletService.processFidelityPaymentCompletion(payment._id, payment.userId);

        console.log(`Payment ${payment.transactionRef} updated to status: ${statusFromAPI}`);

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

        if (payment.status === 'COMPLETED' || payment.status === 'Successful') {
            return res.status(400).json({
                success: false,
                message: 'Cannot retry a successful payment'
            });
        }

        // Increment retry count
        payment.retryCount += 1;
        payment.lastRetryAt = new Date();
        payment.status = 'INITIATED';

        await payment.save();

        // Retry virtual account creation
        const virtualAccountResponse = await FidelityPaymentService.createVirtualAccount({
            amount: Math.round(payment.amount * 100),
            customerEmail: payment.customer.email,
            customerFirstName: payment.customer.firstName,
            customerLastName: payment.customer.lastName,
            customerMobile: payment.customer.phone,
            transactionRef: payment.transactionRef,
            metadata: payment.metadata
        });

        if (virtualAccountResponse.success) {
            const responseData = virtualAccountResponse.data;
            const providerResponse = responseData?.data?.provider_response;
            const virtualAccount = responseData?.virtual_account || responseData?.data?.virtual_account || providerResponse || responseData;

            if (!virtualAccount?.account_number) {
                fidelityPayment.status = 'FAILED';
                fidelityPayment.virtualAccount = {
                    bankName: virtualAccount?.bank_name,
                    accountNumber: virtualAccount?.account_number,
                    accountName: virtualAccount?.account_name,
                    reference: virtualAccount?.reference,
                    status: 'FAILED'
                };
                await fidelityPayment.save();
                throw new Error('Virtual account not returned by Fidelity');
            }

            payment.fidelityResponse = {
                statusFromAPI: 'success',
                message: 'Virtual account created successfully',
                accountNumber: virtualAccount?.account_number,
                accountName: virtualAccount?.account_name,
                bankName: virtualAccount?.bank_name,
                accountReference: virtualAccount?.reference,
                transactionRef: responseData.transaction_ref
            };
            payment.virtualAccount = {
                bankName: virtualAccount?.bank_name,
                accountNumber: virtualAccount?.account_number,
                accountName: virtualAccount?.account_name,
                reference: virtualAccount?.reference,
                status: virtualAccount?.status
            };
            payment.status = 'WAITING_FOR_TRANSFER';

            await payment.save();

            return res.status(200).json({
                success: true,
                fundingType: "BANK_TRANSFER",
                paymentId: payment._id,
                status: 'WAITING_FOR_TRANSFER',
                amount: payment.amount,
                virtualAccount: {
                    bankName: virtualAccount?.bank_name || 'Fidelity Bank',
                    accountNumber: virtualAccount?.account_number,
                    accountName: virtualAccount?.account_name,
                    reference: virtualAccount?.reference
                },
                message: "Transfer funds to the account details provided"
            });
        }

        return res.status(virtualAccountResponse.statusCode).json({
            success: false,
            message: 'Virtual account retry failed',
            error: virtualAccountResponse.error
        });
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
  createVirtualAccount,
  getPaymentStatus,
  getPaymentHistory,
  handleWebhook,
  retryPayment
};
