import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  googleId?: string;
  email: string;
  name: string;
  avatarUrl: string;
  passwordHash: string | null;
  isMaster: boolean;
  canCreateLeagues: boolean;
  leagueOrder: Types.ObjectId[];
  totalPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    passwordHash: { type: String, default: null, select: false },
    isMaster: { type: Boolean, default: false },
    canCreateLeagues: { type: Boolean, default: false },
    leagueOrder: [{ type: Schema.Types.ObjectId, ref: 'League' }],
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
