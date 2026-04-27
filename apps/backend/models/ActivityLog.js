import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
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
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'create_request',
        'update_request',
        'delete_request',
        'create_collection',
        'update_collection',
        'delete_collection',
        'import_collection',
        'create_project',
        'update_project',
        'delete_project',
        'invite_member',
        'join_team',
        'execute_request',
      ],
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityType: {
      type: String,
      enum: ['request', 'collection', 'project', 'team', 'environment'],
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ teamId: 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
