import mongoose from 'mongoose';

const clientLogEntrySchema = new mongoose.Schema(
  {
    timestamp: String,
    severity: {
      type: String,
      enum: ['error', 'warning', 'info'],
      default: 'error',
    },
    message: String,
    stack: String,
    context: mongoose.Schema.Types.Mixed,
    userAgent: String,
    url: String,
    userId: String,
    requestId: String,
    statusCode: Number,
    path: String,
    method: String,
  },
  { _id: false }
);

const clientErrorLogSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    source: {
      type: String,
      default: 'web-client',
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedUserId: {
      type: String,
      trim: true,
    },
    submittedByEmail: {
      type: String,
      trim: true,
    },
    requestId: {
      type: String,
      trim: true,
    },
    exportedAt: String,
    logs: {
      type: [clientLogEntrySchema],
      default: [],
    },
    summary: {
      totalLogs: Number,
      errorCount: Number,
      warningCount: Number,
      infoCount: Number,
    },
    clientMeta: {
      userAgent: String,
      currentUrl: String,
    },
  },
  {
    timestamps: true,
  }
);

clientErrorLogSchema.index({ createdAt: -1 });
clientErrorLogSchema.index({ requestId: 1 });

export default mongoose.model('ClientErrorLog', clientErrorLogSchema);
