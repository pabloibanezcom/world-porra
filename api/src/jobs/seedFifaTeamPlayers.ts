/**
 * Seeds embedded player catalogs from FIFA's official World Cup 2026 squad API.
 * Run with: npm run seed:fifa-team-players
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { fetchFifaSquad } from '../services/fifaSquadService';
import {
  SCENARIOS,
  getDbName,
  getScenarioDbName,
  uriWithDbName,
} from './tournamentScenarios';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FIFA_TEAM_SLUGS: Record<string, string> = {
  ALG: 'algeria',
  ARG: 'argentina',
  AUS: 'australia',
  AUT: 'austria',
  BEL: 'belgium',
  BIH: 'bosnia-herzegovina',
  BRA: 'brazil',
  CAN: 'canada',
  CIV: 'cote-d-ivoire',
  COD: 'congo-dr',
  COL: 'colombia',
  CPV: 'cabo-verde',
  CRO: 'croatia',
  CUW: 'curacao',
  CZE: 'czechia',
  ECU: 'ecuador',
  EGY: 'egypt',
  ENG: 'england',
  ESP: 'spain',
  FRA: 'france',
  GER: 'germany',
  GHA: 'ghana',
  HAI: 'haiti',
  IRN: 'ir-iran',
  IRQ: 'iraq',
  JOR: 'jordan',
  JPN: 'japan',
  KOR: 'korea-republic',
  MAR: 'morocco',
  MEX: 'mexico',
  NED: 'netherlands',
  NOR: 'norway',
  NZL: 'new-zealand',
  PAN: 'panama',
  PAR: 'paraguay',
  POR: 'portugal',
  QAT: 'qatar',
  RSA: 'south-africa',
  SCO: 'scotland',
  KSA: 'saudi-arabia',
  SEN: 'senegal',
  SUI: 'switzerland',
  SWE: 'sweden',
  TUN: 'tunisia',
  TUR: 'turkiye',
  URU: 'uruguay',
  USA: 'usa',
  UZB: 'uzbekistan',
};

interface TeamPlayersByCode {
  code: string;
  players: Awaited<ReturnType<typeof fetchFifaSquad>>;
}

interface DbSeedResult {
  dbName: string;
  matched: number;
  modified: number;
  missing: string[];
}

function getBaseMongoUri(): string {
  const uri = env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI or SCENARIO_BASE_MONGODB_URI is required');
  return uri;
}

function getTargetDbNames(baseMongoUri: string): string[] {
  const baseDbName = getDbName(baseMongoUri);
  return [
    baseDbName,
    ...SCENARIOS.map((scenario) => getScenarioDbName(baseDbName, scenario)),
  ];
}

async function fetchTeamPlayers(): Promise<TeamPlayersByCode[]> {
  const results: TeamPlayersByCode[] = [];

  for (const [code, slug] of Object.entries(FIFA_TEAM_SLUGS)) {
    const players = await fetchFifaSquad({ slug });
    results.push({ code, players });
    logger.info({ code, slug, playerCount: players.length }, 'Fetched FIFA squad');
  }

  return results;
}

async function seedDb(dbName: string, teams: TeamPlayersByCode[]): Promise<DbSeedResult> {
  const collection = mongoose.connection.getClient().db(dbName).collection('countryteams');
  let matched = 0;
  let modified = 0;
  const missing: string[] = [];

  for (const team of teams) {
    const result = await collection.updateOne({ code: team.code }, { $set: { players: team.players } });
    matched += result.matchedCount;
    modified += result.modifiedCount;
    if (result.matchedCount === 0) missing.push(team.code);
  }

  return { dbName, matched, modified, missing };
}

async function seedFifaTeamPlayers(): Promise<void> {
  const baseMongoUri = getBaseMongoUri();
  const dbNames = getTargetDbNames(baseMongoUri);
  const teamPlayers = await fetchTeamPlayers();

  await mongoose.connect(uriWithDbName(baseMongoUri, dbNames[0]));

  const results: DbSeedResult[] = [];
  for (const dbName of dbNames) {
    results.push(await seedDb(dbName, teamPlayers));
  }

  results.forEach((result) => {
    logger.info({
      dbName: result.dbName,
      matched: result.matched,
      modified: result.modified,
      missing: result.missing,
    }, 'Seeded FIFA team players');
  });

  await mongoose.disconnect();
}

seedFifaTeamPlayers()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'seedFifaTeamPlayers failed');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
