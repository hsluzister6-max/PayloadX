import mongoose from 'mongoose';

const workflowNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['api', 'condition', 'delay', 'transform'] },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  data: {
    name: { type: String, required: true },
    method: String,
    url: String,
    headers: [{
      key: String,
      value: String,
      enabled: { type: Boolean, default: true },
    }],
    params: [{
      key: String,
      value: String,
      enabled: { type: Boolean, default: true },
    }],
    body: mongoose.Schema.Types.Mixed,
    data_mappings: [{
      target_field: String,
      source_expression: String,
      transform: String,
    }],
    validations: [{
      type: { type: String, enum: ['status', 'body', 'header', 'schema', 'custom'] },
      field: String,
      operator: { type: String, enum: ['equals', 'contains', 'matches', 'exists', 'gt', 'lt', 'gte', 'lte'] },
      expected: mongoose.Schema.Types.Mixed,
      error_message: String,
    }],
    timeout: Number,
    retries: Number,
  },
}, { _id: false });

const workflowEdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: String,
  condition: String,
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  nodes: [workflowNodeSchema],
  edges: [workflowEdgeSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
}, {
  timestamps: true,
});

// Indexes for performance
workflowSchema.index({ teamId: 1, createdAt: -1 });
workflowSchema.index({ projectId: 1 });
workflowSchema.index({ createdBy: 1 });

// Ensure virtuals are serialized
workflowSchema.set('toJSON', { virtuals: true });
workflowSchema.set('toObject', { virtuals: true });

workflowSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

export default mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema);
