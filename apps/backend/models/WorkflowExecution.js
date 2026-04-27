import mongoose from 'mongoose';

const validationResultSchema = new mongoose.Schema({
  type: String,
  passed: Boolean,
  expected: mongoose.Schema.Types.Mixed,
  actual: mongoose.Schema.Types.Mixed,
  message: String,
}, { _id: false });

const nodeExecutionResultSchema = new mongoose.Schema({
  node_id: String,
  node_name: String,
  start_time: String,
  end_time: String,
  duration: Number,
  status: { type: String, enum: ['success', 'failed', 'skipped'] },
  request: {
    method: String,
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
  },
  response: {
    status: Number,
    status_text: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    size: Number,
  },
  validations: [validationResultSchema],
  error: {
    message: String,
    type: String,
    stack: String,
  },
  extracted_data: mongoose.Schema.Types.Mixed,
}, { _id: false });

const workflowExecutionSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  workflowName: { type: String, required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  duration: { type: Number, required: true },
  
  status: { type: String, enum: ['success', 'failed', 'partial'], required: true },
  
  total_nodes: { type: Number, required: true },
  success_count: { type: Number, required: true },
  failed_count: { type: Number, required: true },
  skipped_count: { type: Number, required: true },
  
  node_results: [nodeExecutionResultSchema],
  
  environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment' },
  environmentName: String,
}, {
  timestamps: true,
});

// Indexes
workflowExecutionSchema.index({ workflowId: 1, createdAt: -1 });
workflowExecutionSchema.index({ teamId: 1, createdAt: -1 });
workflowExecutionSchema.index({ executedBy: 1 });
workflowExecutionSchema.index({ status: 1 });
// Ensure virtuals are serialized
workflowExecutionSchema.set('toJSON', { virtuals: true });
workflowExecutionSchema.set('toObject', { virtuals: true });

workflowExecutionSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

export default mongoose.models.WorkflowExecution || mongoose.model('WorkflowExecution', workflowExecutionSchema);
