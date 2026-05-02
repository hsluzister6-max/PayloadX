import mongoose from 'mongoose';

const OtpSessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically delete document after 24 hours
  }
});

export default mongoose.models.OtpSession || mongoose.model('OtpSession', OtpSessionSchema);
