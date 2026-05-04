import dotenv from 'dotenv';
import path from 'path';
import {
  getDbName,
  getScenarioDbName,
  scenarioBySlug,
  scenarioList,
  uriWithDbName,
} from './tournamentScenarios';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function usage(): string {
  return [
    'Usage: npm run api:scenario -- <scenario>',
    '',
    `Scenarios: ${scenarioList()}`,
    '',
    'Starts the API against a preseeded scenario database without editing api/.env.',
  ].join('\n');
}

async function main(): Promise<void> {
  const [slug] = process.argv.slice(2);
  if (!slug || slug === '--help' || slug === '-h') {
    console.log(usage());
    return;
  }

  const scenario = scenarioBySlug(slug);
  if (!scenario) {
    throw new Error(`Unknown scenario "${slug}"\n\n${usage()}`);
  }

  const baseMongoUri = process.env.MONGODB_URI;
  if (!baseMongoUri) {
    throw new Error('MONGODB_URI is required in api/.env');
  }

  const sourceDbName = getDbName(baseMongoUri);
  const scenarioDbName = getScenarioDbName(sourceDbName, scenario);

  process.env.MONGODB_URI = uriWithDbName(baseMongoUri, scenarioDbName);
  process.env.TOURNAMENT_NOW = scenario.now;
  process.env.FOOTBALL_DATA_API_KEY = '';

  console.log([
    `Starting API with ${scenario.label} (${scenario.slug})`,
    `  DB: ${scenarioDbName}`,
    `  TOURNAMENT_NOW=${scenario.now}`,
    '  Fixture sync jobs disabled for scenario runs',
  ].join('\n'));

  await import('../index');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
