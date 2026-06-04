import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Payment details from frontend
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
  bankCode: {
    type: String,
    default: '',
    trim: true
  },
  branchCode: {
    type: String,
    default: '',
    trim: true
  },
  // Invoice document details
  invoiceFileName: {
    type: String,
    required: true
  },
  invoiceOriginalFileName: {
    type: String,
    required: true
  },
  invoiceS3Key: {
    type: String,
    required: true,
    unique: true
  },
  invoiceS3Bucket: {
    type: String,
    required: true
  },
  invoiceFileSize: {
    type: Number,
    required: true
  },
  invoiceMimeType: {
    type: String,
    required: true,
    enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  },
  // Financial details
  foreignAmount: {
    type: Number,
    required: true,
    min: 0
  },
  foreignCurrency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'NGN']
  },
  localAmount: {
    type: Number,
    required: true,
    min: 0
  },
  exchangeRate: {
    type: Number,
    required: true,
    min: 0
  },
  // Status and approval
  status: {
    type: String,
    enum: ['pending_admin_approval', 'approved', 'rejected', 'submitted_to_reap', 'processing', 'completed', 'failed'],
    default: 'pending_admin_approval',
    index: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  processedAt: Date,
  completedAt: Date,
  // Reap Payment API integration
  reapPaymentId: {
    type: String,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  reapStatus: {
    type: String,
    enum: ['not_sent', 'sent', 'processing', 'completed', 'failed'],
    default: 'not_sent'
  },
  reapRawResponse: {
    type: mongoose.Schema.Types.Mixed // Store full API response data
  },
  reapDocumentUploadResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  reapErrorMessage: {
    type: String
  },
  // Tracking
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ status: 1, submittedAt: -1 });
paymentSchema.index({ reapPaymentId: 1 });

// Virtual for invoice URL (pre-signed URL should be generated when needed)
paymentSchema.virtual('invoiceUrl').get(function() {
  // This will be populated with pre-signed URL when retrieved
  return null;
});

// Ensure virtual fields are serialized
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Payment', paymentSchema);
