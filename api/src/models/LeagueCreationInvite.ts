import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeagueCreationInvite extends Document {
  token: string;
  createdBy: Types.ObjectId;
  usedBy: Types.ObjectId | null;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leagueCreationInviteSchema = new Schema<ILeagueCreationInvite>(
  {
    token: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const LeagueCreationInvite = mongoose.model<ILeagueCreationInvite>(
  'LeagueCreationInvite',
  leagueCreationInviteSchema
);
