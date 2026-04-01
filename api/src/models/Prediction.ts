import mongoose, { Schema, Document, Types } from 'mongoose';
import { MatchWinner } from './Match';

export interface IPrediction extends Document {
  userId: Types.ObjectId;
  matchId: Types.ObjectId;
  homeGoals: number;
  awayGoals: number;
  predictedWinner: MatchWinner;
  points: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const predictionSchema = new Schema<IPrediction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    homeGoals: { type: Number, required: true, min: 0, max: 15 },
    awayGoals: { type: Number, required: true, min: 0, max: 15 },
    predictedWinner: {
      type: String,
      enum: ['HOME', 'AWAY', 'DRAW'],
      required: true,
    },
    points: { type: Number, default: null },
  },
  { timestamps: true }
);

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });
predictionSchema.index({ matchId: 1 });

export const Prediction = mongoose.model<IPrediction>('Prediction', predictionSchema);
