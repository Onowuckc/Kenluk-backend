import mongoose from 'mongoose';

const kycDocumentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  documentType: {
    type: String,
    required: true,
    enum: ['bvn', 'cac', 'proofOfAddress', 'tin', 'directorInfo', 'passport'],
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true,
    unique: true
  },
  s3Bucket: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
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
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
kycDocumentSchema.index({ userId: 1, documentType: 1 });
kycDocumentSchema.index({ status: 1, uploadedAt: -1 });

// Virtual for file URL (pre-signed URL should be generated when needed)
kycDocumentSchema.virtual('fileUrl').get(function() {
  // This will be populated with pre-signed URL when retrieved
  return null;
});

// Ensure virtual fields are serialized
kycDocumentSchema.set('toJSON', { virtuals: true });
kycDocumentSchema.set('toObject', { virtuals: true });

export default mongoose.model('KycDocument', kycDocumentSchema);
