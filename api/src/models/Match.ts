import mongoose, { Schema, Document } from 'mongoose';

export type MatchStage =
  | 'GROUP'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
export type MatchWinner = 'HOME' | 'AWAY' | 'DRAW';

export interface ITeamInfo {
  name: string;
  code: string;
  crest: string;
}

export interface IMatchResult {
  homeGoals: number;
  awayGoals: number;
  winner: MatchWinner;
}

export interface IMatch extends Document {
  externalId: number;
  stage: MatchStage;
  group: string | null;
  matchday: number;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeam?: ITeamInfo;
  awayTeam?: ITeamInfo;
  utcDate: Date;
  status: MatchStatus;
  result: IMatchResult | null;
  scoresProcessed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamInfoSchema = new Schema<ITeamInfo>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    crest: { type: String, default: '' },
  },
  { _id: false }
);

const matchResultSchema = new Schema<IMatchResult>(
  {
    homeGoals: { type: Number, required: true },
    awayGoals: { type: Number, required: true },
    winner: { type: String, enum: ['HOME', 'AWAY', 'DRAW'], required: true },
  },
  { _id: false }
);

const matchSchema = new Schema<IMatch>(
  {
    externalId: { type: Number, required: true, unique: true },
    stage: {
      type: String,
      enum: ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'],
      required: true,
    },
    group: { type: String, default: null },
    matchday: { type: Number, required: true },
    homeTeamCode: { type: String, required: true, uppercase: true, trim: true },
    awayTeamCode: { type: String, required: true, uppercase: true, trim: true },
    homeTeam: { type: teamInfoSchema, default: undefined, select: false },
    awayTeam: { type: teamInfoSchema, default: undefined, select: false },
    utcDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED'],
      default: 'SCHEDULED',
    },
    result: { type: matchResultSchema, default: null },
    scoresProcessed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

matchSchema.index({ utcDate: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ homeTeamCode: 1 });
matchSchema.index({ awayTeamCode: 1 });

export const Match = mongoose.model<IMatch>('Match', matchSchema);
