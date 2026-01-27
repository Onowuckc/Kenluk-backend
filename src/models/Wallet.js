import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true
        },

        // Balance tracking
        balance: {
            type: Number,
            default: 0,
            min: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },

        // Status
        status: {
            type: String,
            enum: ['active', 'suspended', 'frozen'],
            default: 'active'
        },

        // Account info
        accountNumber: String,
        accountHolder: String,
        bankName: String,

        // Metadata
        metadata: {
            type: Map,
            of: String
        },

        // Timestamps
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Indexes
walletSchema.index({ userId: 1, balance: 1 });

// Pre-save middleware
walletSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to check if sufficient balance
walletSchema.methods.hasSufficientBalance = function (amount) {
    return this.balance >= amount;
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
