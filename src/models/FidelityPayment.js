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
                'Pending',
                'Processing',
                'WaitingForOTP',
                'ProcessingOTP',
                'Successful',
                'Failed',
                'OfflineValidating',
                'OfflineValidated',
                'OfflineNotifying',
                'OfflineNotified',
                'Cancelled'
            ],
            default: 'Pending',
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
            mainError: String
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

// Pre-save middleware
fidelityPaymentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to mark as successful
fidelityPaymentSchema.methods.markAsSuccessful = function (webhookData) {
    this.status = 'Successful';
    this.completedAt = Date.now();
    this.webhookData = webhookData;
    this.webhookReceived = true;
    this.webhookReceivedAt = Date.now();
    return this.save();
};

// Method to mark as failed
fidelityPaymentSchema.methods.markAsFailed = function (error) {
    this.status = 'Failed';
    this.completedAt = Date.now();
    if (error) {
        this.fidelityResponse.mainError = error;
    }
    return this.save();
};

// Method to update from webhook
fidelityPaymentSchema.methods.updateFromWebhook = function (webhookData) {
    this.status = webhookData.statusFromAPI;
    this.fidelityResponse = webhookData;
    this.webhookReceived = true;
    this.webhookReceivedAt = Date.now();

    if (webhookData.statusFromAPI === 'Successful') {
        this.completedAt = Date.now();
    }

    return this.save();
};

const FidelityPayment = mongoose.model('FidelityPayment', fidelityPaymentSchema);
export default FidelityPayment;
