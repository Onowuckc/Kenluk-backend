import mongoose from 'mongoose';

const WalletTransactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  reference: {
    type: String
  },
  metadata: {
    type: Object
  }
}, { timestamps: true });

const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;
