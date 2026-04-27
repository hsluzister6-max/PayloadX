import mongoose from 'mongoose';

const QueryParamSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    name:        { type: String, required: true },
    type:        { type: String, enum: ['string', 'number', 'integer', 'boolean', 'array', 'object'], default: 'string' },
    required:    { type: Boolean, default: false },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const HeaderParamSchema = new mongoose.Schema(
  {
    id:    { type: String, required: true },
    key:   { type: String, required: true },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const ResponseSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    statusCode:  { type: Number, required: true, default: 200 },
    description: { type: String, default: '' },
    schema:      { type: String, default: '{}' },       // stringified JSON
    contentType: { type: String, default: 'application/json' },
  },
  { _id: false }
);

const EndpointSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    path:        { type: String, required: true, default: '/' },
    method:      { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'], default: 'GET' },
    summary:     { type: String, default: '' },
    description: { type: String, default: '' },
    tags:        [{ type: String }],
    queryParams: [QueryParamSchema],
    headers:     [HeaderParamSchema],
    requestBody: {
      schema:      { type: String, default: '{}' },
      contentType: { type: String, default: 'application/json' },
    },
    responses: [ResponseSchema],
    deprecated: { type: Boolean, default: false },
  },
  { _id: false }
);

const ApiDocSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Documentation name is required'],
      trim:      true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    description: { type: String, default: '' },
    version:     { type: String, default: '1.0.0' },
    baseUrl:     { type: String, default: '' },
    projectId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Project',
      required: true,
      index:    true,
    },
    teamId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Team',
      required: true,
      index:    true,
    },
    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    endpoints: [EndpointSchema],
    spec:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.ApiDoc || mongoose.model('ApiDoc', ApiDocSchema);
