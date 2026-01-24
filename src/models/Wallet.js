import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['credit', 'debit'], // credit = funding, debit = payment
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    relatedId: {
        // Reference to FidelityPayment (for credit) or Payment (for debit)
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'transactionType'
    },
    transactionType: {
        type: String,
        enum: ['FidelityPayment', 'Payment'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

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
            default: 'NGN'
        },

        // Transaction history
        transactions: [walletTransactionSchema],

        // Funding history (credit only)
        fundingHistory: {
            totalFunded: {
                type: Number,
                default: 0
            },
            lastFundedAt: Date,
            fundingCount: {
                type: Number,
                default: 0
            }
        },

        // Payment debit history
        paymentHistory: {
            totalPaid: {
                type: Number,
                default: 0
            },
            lastPaidAt: Date,
            paymentCount: {
                type: Number,
                default: 0
            }
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
walletSchema.index({ 'transactions.createdAt': -1 });

// Pre-save middleware
walletSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Method to fund wallet (add balance)
walletSchema.methods.fundAccount = function (amount, fidelityPaymentId, description = 'Account funding') {
    if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }

    // Add transaction
    this.transactions.push({
        type: 'credit',
        amount,
        description,
        relatedId: fidelityPaymentId,
        transactionType: 'FidelityPayment',
        status: 'completed'
    });

    // Update balance
    this.balance += amount;

    // Update funding history
    this.fundingHistory.totalFunded += amount;
    this.fundingHistory.lastFundedAt = Date.now();
    this.fundingHistory.fundingCount += 1;

    return this.save();
};

// Method to withdraw for payment (deduct balance)
walletSchema.methods.withdrawForPayment = function (amount, paymentId, description = 'Payment submission') {
    if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }

    if (this.balance < amount) {
        throw new Error(`Insufficient balance. Available: ${this.balance}, Required: ${amount}`);
    }

    // Add transaction
    this.transactions.push({
        type: 'debit',
        amount,
        description,
        relatedId: paymentId,
        transactionType: 'Payment',
        status: 'completed'
    });

    // Update balance
    this.balance -= amount;

    // Update payment history
    this.paymentHistory.totalPaid += amount;
    this.paymentHistory.lastPaidAt = Date.now();
    this.paymentHistory.paymentCount += 1;

    return this.save();
};

// Method to check if sufficient balance
walletSchema.methods.hasSufficientBalance = function (amount) {
    return this.balance >= amount;
};

// Method to get transaction history
walletSchema.methods.getTransactionHistory = function (limit = 20, skip = 0) {
    const sorted = this.transactions.sort((a, b) => b.createdAt - a.createdAt);
    return {
        transactions: sorted.slice(skip, skip + limit),
        total: this.transactions.length,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(this.transactions.length / limit)
    };
};

// Method to get funding history only
walletSchema.methods.getFundingHistory = function (limit = 20, skip = 0) {
    const fundingTxs = this.transactions
        .filter(tx => tx.type === 'credit')
        .sort((a, b) => b.createdAt - a.createdAt);

    return {
        transactions: fundingTxs.slice(skip, skip + limit),
        total: fundingTxs.length,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(fundingTxs.length / limit)
    };
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
