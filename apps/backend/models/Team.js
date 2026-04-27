import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'developer', 'viewer'], default: 'developer' },
  joinedAt: { type: Date, default: Date.now },
});

const TeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: [MemberSchema],
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    inviteToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.Team || mongoose.model('Team', TeamSchema);
