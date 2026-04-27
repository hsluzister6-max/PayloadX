import mongoose from 'mongoose';

const VariableSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Variable key is required'],
      trim: true,
    },
    value: { type: String, default: '' },
    description: { type: String, default: '' },
    isSecret: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { _id: true } // Keep _id so we can update individual variables
);

const EnvironmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Environment name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: { type: String, default: '', trim: true },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    variables: [VariableSchema],

    // Whether this env is global across all projects in the team
    isGlobal: { type: Boolean, default: false },

    // Color tag for UI identification
    color: { type: String, default: '#6366f1' },
  },
  { timestamps: true }
);

// Compound uniqueness: same name can't exist twice in same project
EnvironmentSchema.index({ projectId: true, name: 1 }, { unique: true });

export default mongoose.models.Environment ||
  mongoose.model('Environment', EnvironmentSchema);

/**
 * Standalone helper — masks secret variable values.
 * Use this in route files instead of env.toSafeObject().
 * Safe against Mongoose model caching in Next.js HMR/serverless.
 */
export function maskSecrets(envDoc) {
  const obj = envDoc.toObject ? envDoc.toObject() : { ...envDoc };
  obj.variables = (obj.variables || []).map((v) => ({
    ...v,
    value: v.isSecret ? '' : v.value,
    _masked: Boolean(v.isSecret),
  }));
  return obj;
}
