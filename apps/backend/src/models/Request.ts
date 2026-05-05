import mongoose, { Schema, Document } from 'mongoose';

export interface IRequest extends Document {
  name: string;
  method: string;
  url: string;
  headers: any[];
  params: any[];
  body: any;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RequestSchema: Schema = new Schema({
  name: { type: String, required: true },
  method: { type: String, required: true, default: 'GET' },
  url: { type: String, required: true },
  headers: { type: [Schema.Types.Mixed], default: [] },
  params: { type: [Schema.Types.Mixed], default: [] },
  body: { type: Schema.Types.Mixed, default: {} },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IRequest>('Request', RequestSchema);
