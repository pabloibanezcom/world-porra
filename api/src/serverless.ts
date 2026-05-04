import { app } from './app';
import { connectDB } from './config/db';
import { resolveRuntimeScenario } from './config/scenarioRuntime';
import { backfillCountryCodes } from './services/countryTeamService';

const seededDbs = new Set<string>();

export default async function handler(req: any, res: any) {
  let scenario;
  try {
    scenario = resolveRuntimeScenario(req);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid scenario' });
    return;
  }

  await connectDB(scenario?.mongodbUri);
  const dbKey = scenario?.dbName ?? 'default';

  if (!seededDbs.has(dbKey)) {
    await backfillCountryCodes();
    seededDbs.add(dbKey);
  }

  return app(req, res);
}
