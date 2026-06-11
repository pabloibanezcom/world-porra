import mongoose, { Schema, Document } from 'mongoose';
import { MATCH_STAGES, MATCH_STATUSES, MATCH_WINNERS } from '../shared';
import type { MatchStage, MatchStatus, MatchWinner } from '../shared';

export type { MatchStage, MatchStatus, MatchWinner } from '../shared';

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

export interface IMatchOdds {
  home: number | null;
  draw: number | null;
  away: number | null;
  fetchedAt: Date;
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
  odds: IMatchOdds | null;
  scoresProcessed: boolean;
  // When true, the result was entered by an admin and must not be overwritten
  // by the results sync (which may report a finished match with no score).
  manualResult: boolean;
  // FotMob's match id, cached once a match is mapped so later syncs are direct.
  fotmobMatchId: number | null;
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
    winner: { type: String, enum: MATCH_WINNERS, required: true },
  },
  { _id: false }
);

const matchSchema = new Schema<IMatch>(
  {
    externalId: { type: Number, required: true, unique: true },
    stage: {
      type: String,
      enum: MATCH_STAGES,
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
      enum: MATCH_STATUSES,
      default: 'SCHEDULED',
    },
    result: { type: matchResultSchema, default: null },
    odds: {
      type: new Schema<IMatchOdds>(
        {
          home: { type: Number, default: null },
          draw: { type: Number, default: null },
          away: { type: Number, default: null },
          fetchedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    scoresProcessed: { type: Boolean, default: false },
    manualResult: { type: Boolean, default: false },
    fotmobMatchId: { type: Number, default: null },
  },
  { timestamps: true }
);

matchSchema.index({ utcDate: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ fotmobMatchId: 1 }, { sparse: true });
matchSchema.index({ homeTeamCode: 1 });
matchSchema.index({ awayTeamCode: 1 });

export const Match = mongoose.model<IMatch>('Match', matchSchema);
