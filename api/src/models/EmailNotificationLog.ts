import mongoose, { Schema, Document, Types } from 'mongoose';

export type EmailNotificationType = 'missing_picks';

export interface IEmailNotificationLog extends Document {
  userId: Types.ObjectId;
  type: EmailNotificationType;
  dedupeKey: string;
  dayKey: string;
  provider: 'resend';
  providerMessageId?: string;
  sentAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const emailNotificationLogSchema = new Schema<IEmailNotificationLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['missing_picks'], required: true },
    dedupeKey: { type: String, required: true, maxlength: 300 },
    dayKey: { type: String, required: true, maxlength: 10 },
    provider: { type: String, enum: ['resend'], required: true, default: 'resend' },
    providerMessageId: { type: String, default: '' },
    sentAt: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

emailNotificationLogSchema.index({ sentAt: 1 });
emailNotificationLogSchema.index({ userId: 1, type: 1, dedupeKey: 1, dayKey: 1 }, { unique: true });

export const EmailNotificationLog = mongoose.model<IEmailNotificationLog>('EmailNotificationLog', emailNotificationLogSchema);
