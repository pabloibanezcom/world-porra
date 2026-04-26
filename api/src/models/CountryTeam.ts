import mongoose, { Schema, Document } from 'mongoose';

export interface ICountryTeam extends Document {
  code: string;
  names: Map<string, string>;
  crest: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

const countryTeamSchema = new Schema<ICountryTeam>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    names: { type: Map, of: String, required: true },
    crest: { type: String, default: '' },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true }
);

countryTeamSchema.index({ aliases: 1 });

export const CountryTeam = mongoose.model<ICountryTeam>('CountryTeam', countryTeamSchema);
