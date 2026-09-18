import mongoose from 'mongoose';

/**
 * Product analytics: section views, clicks, and custom UI events.
 * Ingested by authenticated clients; aggregated for platform admins.
 */
const AnalyticsEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    sessionId: { type: String, index: true, maxlength: 64 },
    /** Logical product surface: dashboard, collections, workflow, … */
    section: {
      type: String,
      required: true,
      maxlength: 64,
      index: true,
    },
    /**
     * view | click | cta_click | nav | action | error
     */
    eventType: {
      type: String,
      required: true,
      enum: ['view', 'click', 'cta_click', 'nav', 'action', 'error'],
      index: true,
    },
    /** Optional target within the section (button id, tab, etc.) */
    target: { type: String, maxlength: 128, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    client: {
      type: String,
      enum: ['desktop', 'landing', 'web', 'other'],
      default: 'desktop',
    },
  },
  { timestamps: true }
);

AnalyticsEventSchema.index({ createdAt: -1 });
AnalyticsEventSchema.index({ section: 1, eventType: 1, createdAt: -1 });

export default mongoose.models.AnalyticsEvent ||
  mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
