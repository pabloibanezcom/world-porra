import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserDeviceDisplayMode = 'browser' | 'standalone' | 'unknown';
export type UserDevicePlatform = 'web' | 'ios' | 'android' | 'unknown';

export interface IUserDevice extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  displayMode: UserDeviceDisplayMode;
  platform: UserDevicePlatform;
  userAgent: string;
  browserLanguage: string;
  lastSeenAt: Date;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userDeviceSchema = new Schema<IUserDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String, required: true, trim: true, maxlength: 120 },
    displayMode: { type: String, enum: ['browser', 'standalone', 'unknown'], required: true },
    platform: { type: String, enum: ['web', 'ios', 'android', 'unknown'], required: true },
    userAgent: { type: String, default: '', maxlength: 500 },
    browserLanguage: { type: String, default: '', maxlength: 50 },
    lastSeenAt: { type: Date, required: true },
    firstSeenAt: { type: Date, required: true },
  },
  { timestamps: true }
);

userDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
userDeviceSchema.index({ userId: 1, lastSeenAt: -1 });

export const UserDevice = mongoose.model<IUserDevice>('UserDevice', userDeviceSchema);
