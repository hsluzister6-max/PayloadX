import mongoose from 'mongoose';

const FolderSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  parentId: { type: String, default: null }, // Support for nested folders
  requestIds: [{ type: String }],
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

const CollectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: [200, 'Collection name cannot exceed 200 characters'],
    },
    description: { type: String, default: '' },
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
    folders: [FolderSchema],
    variables: [
      {
        key: String,
        value: String,
        description: String,
      },
    ],
    version: { type: String, default: '1.0.0' },
    isImported: { type: Boolean, default: false },
    importSource: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.Collection || mongoose.model('Collection', CollectionSchema);
