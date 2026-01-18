import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema({
  // Exchange rates - admin controlled
  usdToNgnRate: {
    type: Number,
    required: true,
    min: 0,
    default: 1500 // Default rate, should be updated by admin
  },
  ngnToUsdRate: {
    type: Number,
    required: true,
    min: 0,
    default: 0.0006667 // Default rate (1/1500)
  },

  // Audit trail
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Metadata
  notes: {
    type: String,
    default: ''
  }
}, { 
  timestamps: true,
  collection: 'platform_settings'
});

// Ensure only one document exists in this collection
platformSettingsSchema.index({ _id: 1 }, { unique: false });

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
