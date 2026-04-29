/**
 * Seeds national team colors into CountryTeam documents.
 * Colors represent the primary kit/flag color for each team.
 * GER uses #888888 instead of #000000 for visibility on dark backgrounds.
 * Run with: npm run seed:team-colors
 */
import { connectDB } from '../config/db';
import { CountryTeam } from '../models/CountryTeam';
import { logger } from '../config/logger';

const TEAM_COLORS: Record<string, string> = {
  ALG: '#006233',
  ARG: '#74ACDF',
  AUS: '#00008B',
  AUT: '#ED2939',
  BEL: '#EF3340',
  BIH: '#002395',
  BRA: '#009C3B',
  CAN: '#FF0000',
  CIV: '#F77F00',
  COD: '#007FFF',
  COL: '#FFE800',
  CPV: '#003893',
  CRO: '#FF0000',
  CUR: '#002B7F',
  CZE: '#D7141A',
  ECU: '#FFD100',
  EGY: '#CE1126',
  ENG: '#CF081F',
  ESP: '#AA151B',
  FRA: '#002395',
  GER: '#888888',
  GHA: '#006B3F',
  HAI: '#00209F',
  IRN: '#239F40',
  IRQ: '#CE1126',
  JOR: '#007A3D',
  JPN: '#BC002D',
  KOR: '#CD2E3A',
  KSA: '#006C35',
  MAR: '#C1272D',
  MEX: '#006847',
  NED: '#FF6600',
  NOR: '#EF2B2D',
  NZL: '#00247D',
  PAN: '#005293',
  PAR: '#D52B1E',
  POR: '#006600',
  QAT: '#8D1B3D',
  RSA: '#007A4D',
  SCO: '#0065BD',
  SEN: '#00853F',
  SER: '#C6363C',
  SUI: '#FF0000',
  SWE: '#006AA7',
  TUN: '#E70013',
  TUR: '#E30A17',
  URU: '#75AADB',
  USA: '#B22234',
  UZB: '#1EB53A',
};

async function seedTeamColors(): Promise<void> {
  await connectDB();

  const results = await Promise.all(
    Object.entries(TEAM_COLORS).map(([code, color]) =>
      CountryTeam.updateOne({ code }, { $set: { color } })
    )
  );

  const updated = results.reduce((sum, r) => sum + r.modifiedCount, 0);
  const notFound = results.reduce((sum, r) => sum + (r.matchedCount === 0 ? 1 : 0), 0);

  logger.info(`Updated ${updated} team colors (${notFound} codes not in DB — will apply on next upsert)`);
  process.exit(0);
}

seedTeamColors().catch((err) => {
  logger.error({ err }, 'seedTeamColors failed');
  process.exit(1);
});
