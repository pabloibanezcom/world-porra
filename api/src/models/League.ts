import mongoose, { Schema, Document, Types } from 'mongoose';

export const LEAGUE_MAX_MEMBERS = 50;

export interface ILeagueMember {
  userId: Types.ObjectId;
  joinedAt: Date;
  isAdmin: boolean;
  hasPaid: boolean;
  paidAt?: Date | null;
}

export interface ILeaguePayoutSplit {
  position: number;
  amount: number;
}

export interface ILeaguePaymentSettings {
  entryFee: number;
  payoutSplits: ILeaguePayoutSplit[];
}

export interface ILeague extends Document {
  name: string;
  inviteCode: string;
  ownerId: Types.ObjectId;
  members: ILeagueMember[];
  maxMembers: number;
  paymentSettings: ILeaguePaymentSettings;
  createdAt: Date;
  updatedAt: Date;
}

const leagueMemberSchema = new Schema<ILeagueMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false },
    hasPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

const leaguePayoutSplitSchema = new Schema<ILeaguePayoutSplit>(
  {
    position: { type: Number, required: true, min: 1, max: 10 },
    amount: { type: Number, required: true, min: 0, max: 100000 },
  },
  { _id: false }
);

const leagueSchema = new Schema<ILeague>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    inviteCode: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [leagueMemberSchema],
    maxMembers: { type: Number, default: LEAGUE_MAX_MEMBERS, min: 1, max: LEAGUE_MAX_MEMBERS },
    paymentSettings: {
      entryFee: { type: Number, default: 0, min: 0, max: 100000 },
      payoutSplits: {
        type: [leaguePayoutSplitSchema],
        default: [
          { position: 1, amount: 0 },
          { position: 2, amount: 0 },
          { position: 3, amount: 0 },
        ],
      },
    },
  },
  { timestamps: true }
);

leagueSchema.index({ 'members.userId': 1 });

export const League = mongoose.model<ILeague>('League', leagueSchema);
