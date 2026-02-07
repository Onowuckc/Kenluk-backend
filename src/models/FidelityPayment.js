import mongoose from 'mongoose';

const fidelityPaymentSchema = new mongoose.Schema(
    {
        // Payment identifiers
        transactionRef: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        requestRef: {
            type: String,
            required: true,
            unique: true
        },
        paygateTransactionRef: {
            type: String,
            index: true
        },

        // User reference
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        // Payment details
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'NGN'
        },
        description: {
            type: String,
            required: true
        },

        // Customer information
        customer: {
            firstName: String,
            lastName: String,
            email: String,
            phone: String,
            customerRef: String
        },

        // Payment status
        status: {
            type: String,
            enum: [
                'INITIATED',
                'VIRTUAL_ACCOUNT_CREATED',
                'WAITING_FOR_TRANSFER',
                'COMPLETED',
                'FAILED',
                'Pending', // Keep for backward compatibility
                'InvoiceSent', // Keep for backward compatibility
                'Processing',
                'WaitingForOTP',
                'ProcessingOTP',
                'Successful',
                'OfflineValidating',
                'OfflineValidated',
                'OfflineNotifying',
                'OfflineNotified',
                'Cancelled'
            ],
            default: 'INITIATED',
            index: true
        },

        // Fidelity API response
        fidelityResponse: {
            statusFromAPI: String,
            message: String,
            providerResponseCode: String,
            provider: String,
            chargeToken: String,
            errors: [String],
            mainError: String,
            accountNumber: String,
            accountName: String,
            bankName: String,
            accountReference: String
        },

        // Virtual account details for bank transfer funding
        virtualAccount: {
            bankName: String,
            accountNumber: String,
            accountName: String,
            reference: {
                type: String,
                index: true
            },
            status: String
        },

        // Payment method
        paymentMethod: {
            type: String,
            enum: ['bank_account', 'card', 'mobile_money'],
            default: 'bank_account'
        },

        // Additional metadata
        metadata: {
            type: Map,
            of: String
        },

        // Payment approval status
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvalNotes: String,

        // Retry information
        retryCount: {
            type: Number,
            default: 0
        },
        lastRetryAt: Date,

        // Webhook information
        webhookReceived: {
            type: Boolean,
            default: false
        },
        webhookData: mongoose.Schema.Types.Mixed,
        webhookReceivedAt: Date,

        // Timestamps
        initiatedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: Date,
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Index for queries
fidelityPaymentSchema.index({ userId: 1, status: 1 });
fidelityPaymentSchema.index({ userId: 1, createdAt: -1 });
fidelityPaymentSchema.index({ status: 1, webhookReceived: 1 });
fidelityPaymentSchema.index({ 'virtualAccount.reference': 1 });
fidelityPaymentSchema.index({ 'virtualAccount.accountNumber': 1 });

// Pre-save middleware
fidelityPaymentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to mark as successful
fidelityPaymentSchema.methods.markAsSuccessful = function (webhookData) {
    this.status = 'COMPLETED';
    this.completedAt = Date.now();
    this.webhookData = webhookData;
    this.webhookReceived = true;
    this.webhookReceivedAt = Date.now();
    return this.save();
};

// Method to mark as failed
fidelityPaymentSchema.methods.markAsFailed = function (error) {
    this.status = 'FAILED';
    this.completedAt = Date.now();
    if (error) {
        this.fidelityResponse.mainError = error;
    }
    return this.save();
};

// Method to update from webhook
fidelityPaymentSchema.methods.updateFromWebhook = function (webhookData) {
    const statusFromAPI = webhookData.statusFromAPI;
    const normalizedStatus =
        statusFromAPI === 'Successful' ? 'COMPLETED'
            : statusFromAPI === 'Failed' ? 'FAILED'
                : statusFromAPI;

    this.status = normalizedStatus;
    this.fidelityResponse = webhookData;
    this.webhookReceived = true;
    this.webhookReceivedAt = Date.now();

    if (normalizedStatus === 'COMPLETED') {
        this.completedAt = Date.now();
    }

    return this.save();
};

const FidelityPayment = mongoose.model('FidelityPayment', fidelityPaymentSchema);
export default FidelityPayment;
