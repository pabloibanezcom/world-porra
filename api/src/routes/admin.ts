import { NextFunction, Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { syncAuthMiddleware } from '../middleware/syncAuth';
import { processFinishedMatches, syncAllFixtures } from '../services/syncService';
import { syncOdds } from '../services/oddsService';
import { seedTournamentScenarios } from '../jobs/seedScenario';
import { SCENARIOS, getDbName, getScenarioDbName, scenarioBySlug } from '../jobs/tournamentScenarios';

const router = Router();

const syncSchema = z.object({
  syncFixtures: z.boolean().default(true),
  processResults: z.boolean().default(true),
  syncOdds: z.boolean().default(false),
});

const seedScenariosSchema = z.object({
  scenarios: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]).default('all'),
});

function redactSensitiveError(value: string): string {
  const withoutMongoCredentials = value.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gu, 'mongodb://<redacted>@');
  return env.SYNC_API_KEY ? withoutMongoCredentials.replace(new RegExp(env.SYNC_API_KEY, 'gu'), '<redacted>') : withoutMongoCredentials;
}

router.post('/sync', syncAuthMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { syncFixtures, processResults, syncOdds: doSyncOdds } = syncSchema.parse(req.body ?? {});

    if (!syncFixtures && !processResults && !doSyncOdds) {
      res.status(400).json({ error: 'At least one sync action must be enabled' });
      return;
    }

    if (syncFixtures && !env.FOOTBALL_DATA_API_KEY) {
      res.status(503).json({ error: 'FOOTBALL_DATA_API_KEY is not configured on the server' });
      return;
    }

    if (doSyncOdds && !env.ODDS_API_KEY) {
      res.status(503).json({ error: 'ODDS_API_KEY is not configured on the server' });
      return;
    }

    logger.info({ syncFixtures, processResults, syncOdds: doSyncOdds }, 'Running manual sync');

    const fixtureResult = syncFixtures ? await syncAllFixtures() : { fixturesSynced: 0 };
    const scoringResult = processResults
      ? await processFinishedMatches()
      : { matchesProcessed: 0, predictionsScored: 0, leaguesUpdated: 0 };
    const oddsResult = doSyncOdds ? await syncOdds() : { matchesUpdated: 0, requestsRemaining: null };

    res.json({
      ok: true,
      syncFixtures,
      processResults,
      syncOdds: doSyncOdds,
      ...fixtureResult,
      ...scoringResult,
      oddsMatchesUpdated: oddsResult.matchesUpdated,
      oddsRequestsRemaining: oddsResult.requestsRemaining,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid sync payload', details: error.errors });
      return;
    }

    next(error);
  }
});

router.post('/scenarios/seed', syncAuthMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { scenarios } = seedScenariosSchema.parse(req.body ?? {});
    const slugs = scenarios === 'all' ? ['all'] : scenarios;

    logger.info({ scenarios: slugs }, 'Seeding tournament scenario databases');

    const results = await seedTournamentScenarios({ slugs });

    res.json({
      ok: true,
      scenarios: results.map(({ mongodbUri, ...result }) => result),
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid scenario seed payload', details: error.errors });
      return;
    }

    const message = error instanceof Error ? redactSensitiveError(error.message) : 'Unknown scenario seed error';
    logger.error({ err: error }, 'Scenario database seed failed');
    res.status(500).json({ error: 'Scenario database seed failed', message });
  }
});

router.post('/scenarios/status', syncAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { scenarios } = seedScenariosSchema.parse(req.body ?? {});
    const selectedScenarios = scenarios === 'all'
      ? SCENARIOS
      : scenarios.map((slug) => {
          const scenario = scenarioBySlug(slug);
          if (!scenario) throw new Error(`Unknown scenario "${slug}"`);
          return scenario;
        });
    const client = mongoose.connection.getClient();
    const baseDbName = getDbName(env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI);

    const statuses = await Promise.all(selectedScenarios.map(async (scenario) => {
      const dbName = getScenarioDbName(baseDbName, scenario);
      const db = client.db(dbName);
      const [matches, users, leagues, predictions, scoredPredictions] = await Promise.all([
        db.collection('matches').countDocuments(),
        db.collection('users').countDocuments(),
        db.collection('leagues').countDocuments(),
        db.collection('predictions').countDocuments(),
        db.collection('predictions').countDocuments({ points: { $ne: null } }),
      ]);

      return {
        slug: scenario.slug,
        dbName,
        matches,
        users,
        leagues,
        predictions,
        scoredPredictions,
      };
    }));

    res.json({ ok: true, scenarios: statuses, ranAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid scenario status payload', details: error.errors });
      return;
    }

    const message = error instanceof Error ? redactSensitiveError(error.message) : 'Unknown scenario status error';
    logger.error({ err: error }, 'Scenario database status failed');
    res.status(500).json({ error: 'Scenario database status failed', message });
  }
});

export default router;
