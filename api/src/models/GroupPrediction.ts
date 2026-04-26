import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGroupPrediction extends Document {
  userId: Types.ObjectId;
  group: string;
  orderedTeamCodes: string[];
  points: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupPredictionSchema = new Schema<IGroupPrediction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: String, required: true },
    orderedTeamCodes: {
      type: [String],
      required: true,
      validate: {
        validator: (codes: string[]) => codes.length >= 2,
        message: 'At least two teams are required',
      },
      set: (codes: string[]) => codes.map((code) => code.trim().toUpperCase()),
    },
    points: { type: Number, default: null },
  },
  { timestamps: true }
);

groupPredictionSchema.index({ userId: 1, group: 1 }, { unique: true });

export const GroupPrediction = mongoose.model<IGroupPrediction>('GroupPrediction', groupPredictionSchema);
