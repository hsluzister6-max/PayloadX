import mongoose from 'mongoose';

const HeaderSchema = new mongoose.Schema({
  key: { type: String, default: '' },
  value: { type: String, default: '' },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
});

const ParamSchema = new mongoose.Schema({
  key: { type: String, default: '' },
  value: { type: String, default: '' },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
});

const RequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Request name is required'],
      trim: true,
      maxlength: [200, 'Request name cannot exceed 200 characters'],
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      default: 'GET',
    },
    url: { type: String, default: '' },
    protocol: {
      type: String,
      enum: ['http', 'ws', 'socketio'],
      default: 'http',
      index: true,
    },
    sioEvent: { type: String, default: 'message' },
    headers: [HeaderSchema],
    params: [ParamSchema],
    body: {
      mode: {
        type: String,
        enum: ['none', 'raw', 'form-data', 'urlencoded'],
        default: 'none',
      },
      raw: { type: String, default: '' },
      rawLanguage: { type: String, enum: ['json', 'text', 'xml', 'html', 'javascript'], default: 'json' },
      formData: [{ key: String, value: String, enabled: Boolean }],
      urlencoded: [{ key: String, value: String, enabled: Boolean }],
    },
    auth: {
      type: {
        type: String,
        enum: ['none', 'bearer', 'basic', 'apikey'],
        default: 'none',
      },
      bearer: { token: String },
      basic: { username: String, password: String },
      apikey: { key: String, value: String, in: String },
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    folderId: { type: String, default: null },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    preRequestScript: { type: String, default: '' },
    testScript: { type: String, default: '' },
  },
  { timestamps: true }
);

if (mongoose.models.Request) {
  delete mongoose.models.Request;
}

const Request = mongoose.model('Request', RequestSchema);
export default Request;
