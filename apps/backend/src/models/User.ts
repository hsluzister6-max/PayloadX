import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  createdAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  googleId: { type: String },
  avatar: { type: String },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  const user = this as any;
  if (!user.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password as string, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  const user = this as any;
  if (!user.password) return false;
  return bcrypt.compare(password, user.password);
};

export default mongoose.model<IUser>('User', UserSchema);
