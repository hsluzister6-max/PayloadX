import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflow extends Document {
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  nodes: { type: [Schema.Types.Mixed], default: [] },
  edges: { type: [Schema.Types.Mixed], default: [] },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
