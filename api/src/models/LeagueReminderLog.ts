import mongoose, { Schema, Document, Types } from 'mongoose';

export type LeagueReminderType = 'payment_unpaid' | 'missing_picks';

export interface ILeagueReminderLog extends Document {
  leagueId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: LeagueReminderType;
  recipients: number;
  sentAt: Date;
  metadata?: Record<string, unknown>;
}

const leagueReminderLogSchema = new Schema<ILeagueReminderLog>(
  {
    leagueId: { type: Schema.Types.ObjectId, ref: 'League', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['payment_unpaid', 'missing_picks'], required: true },
    recipients: { type: Number, required: true, min: 0 },
    sentAt: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

leagueReminderLogSchema.index({ leagueId: 1, type: 1, sentAt: -1 });

export const LeagueReminderLog = mongoose.model<ILeagueReminderLog>('LeagueReminderLog', leagueReminderLogSchema);
