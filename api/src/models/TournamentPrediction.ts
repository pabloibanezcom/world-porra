import mongoose, { Schema, Document, Types } from 'mongoose';

interface PlayerPick {
  name: string;
  team: string;
  code: string;
  pos: string;
}

export interface ITournamentPrediction extends Document {
  userId: Types.ObjectId;
  championCode?: string;
  runnerUpCode?: string;
  semi1Code?: string;
  semi2Code?: string;
  bestPlayer?: PlayerPick;
  topScorer?: PlayerPick;
  bestYoung?: PlayerPick;
  createdAt: Date;
  updatedAt: Date;
}

const playerPickSchema = new Schema<PlayerPick>(
  { name: String, team: String, code: String, pos: String },
  { _id: false }
);

const tournamentPredictionSchema = new Schema<ITournamentPrediction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    championCode: { type: String, uppercase: true, trim: true, default: undefined },
    runnerUpCode: { type: String, uppercase: true, trim: true, default: undefined },
    semi1Code: { type: String, uppercase: true, trim: true, default: undefined },
    semi2Code: { type: String, uppercase: true, trim: true, default: undefined },
    bestPlayer: { type: playerPickSchema, default: undefined },
    topScorer: { type: playerPickSchema, default: undefined },
    bestYoung: { type: playerPickSchema, default: undefined },
  },
  { timestamps: true }
);

export const TournamentPrediction = mongoose.model<ITournamentPrediction>(
  'TournamentPrediction',
  tournamentPredictionSchema
);
