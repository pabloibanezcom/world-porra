/**
 * Seeds embedded player catalogs into CountryTeam documents.
 * Run with: npm run seed:team-players
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  SCENARIOS,
  getDbName,
  getScenarioDbName,
  uriWithDbName,
} from './tournamentScenarios';
import { TEAM_PLAYERS } from './teamPlayers';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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

async function seedDb(dbName: string): Promise<DbSeedResult> {
  const collection = mongoose.connection.getClient().db(dbName).collection('countryteams');
  let matched = 0;
  let modified = 0;
  const missing: string[] = [];

  for (const [code, players] of Object.entries(TEAM_PLAYERS)) {
    const result = await collection.updateOne({ code }, { $set: { players } });
    matched += result.matchedCount;
    modified += result.modifiedCount;
    if (result.matchedCount === 0) missing.push(code);
  }

  return { dbName, matched, modified, missing };
}

async function seedTeamPlayers(): Promise<void> {
  const baseMongoUri = getBaseMongoUri();
  const dbNames = getTargetDbNames(baseMongoUri);

  await mongoose.connect(uriWithDbName(baseMongoUri, dbNames[0]));

  const results: DbSeedResult[] = [];
  for (const dbName of dbNames) {
    results.push(await seedDb(dbName));
  }

  results.forEach((result) => {
    logger.info({
      dbName: result.dbName,
      matched: result.matched,
      modified: result.modified,
      missing: result.missing,
    }, 'Seeded team players');
  });

  await mongoose.disconnect();
}

seedTeamPlayers()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, 'seedTeamPlayers failed');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
