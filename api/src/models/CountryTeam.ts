import mongoose, { Schema, Document } from 'mongoose';

export interface ICountryTeam extends Document {
  code: string;
  names: Map<string, string>;
  crest: string;
  color: string;
  players: Array<{
    name: string;
    pos: 'FW' | 'MF' | 'DF' | 'GK';
    age: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const countryTeamPlayerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    pos: { type: String, required: true, enum: ['FW', 'MF', 'DF', 'GK'] },
    age: { type: Number, required: true, min: 0, max: 60 },
  },
  { _id: false }
);

const countryTeamSchema = new Schema<ICountryTeam>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    names: { type: Map, of: String, required: true },
    crest: { type: String, default: '' },
    color: { type: String, default: '' },
    players: { type: [countryTeamPlayerSchema], default: [] },
  },
  { timestamps: true }
);

export const CountryTeam = mongoose.model<ICountryTeam>('CountryTeam', countryTeamSchema);
