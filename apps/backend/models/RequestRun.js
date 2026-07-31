import mongoose from 'mongoose';

/**
 * Persisted API run / execution events for dashboard analytics.
 * Written by the desktop client after each request send.
 */
const RequestRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      index: true,
    },
    name: { type: String, default: 'Untitled' },
    method: { type: String, default: 'GET' },
    protocol: {
      type: String,
      enum: ['http', 'ws', 'socketio'],
      default: 'http',
    },
    url: { type: String, default: '' },
    status: { type: Number, default: null },
    statusText: { type: String, default: '' },
    responseTimeMs: { type: Number, default: null },
    sizeBytes: { type: Number, default: null },
    success: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RequestRunSchema.index({ teamId: 1, projectId: 1, createdAt: -1 });
RequestRunSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.models.RequestRun || mongoose.model('RequestRun', RequestRunSchema);
