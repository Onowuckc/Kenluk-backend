import mongoose from 'mongoose';

const beneficiarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    nickname: {
      type: String,
      trim: true,
      maxlength: 120
    },
    recipientCompany: {
      type: String,
      required: true,
      trim: true
    },
    recipientBank: {
      type: String,
      required: true,
      trim: true
    },
    recipientBankSwiftCode: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    recipientBankCountry: {
      type: String,
      required: true,
      trim: true
    },
    recipientAddress: {
      type: String,
      required: true,
      trim: true
    },
    recipientBankAddress: {
      type: String,
      required: true,
      trim: true
    },
    useCount: {
      type: Number,
      default: 1
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

beneficiarySchema.index(
  { userId: 1, recipientBankSwiftCode: 1, accountNumber: 1 },
  { unique: true }
);
beneficiarySchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('Beneficiary', beneficiarySchema);
