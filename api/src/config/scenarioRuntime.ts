import { IncomingMessage } from 'http';
import { env } from './env';
import {
  getDbName,
  getScenarioDbName,
  scenarioBySlug,
  uriWithDbName,
} from '../jobs/tournamentScenarios';

export interface RuntimeScenario {
  slug: string;
  label: string;
  now: string;
  mongodbUri: string;
  dbName: string;
}

function getHeaderValue(req: IncomingMessage, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getQueryScenario(req: IncomingMessage): string {
  const host = getHeaderValue(req, 'host') || 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  return url.searchParams.get('scenario') ?? '';
}

export function getRequestedScenarioSlug(req: IncomingMessage): string {
  return (getHeaderValue(req, 'x-wc-scenario') || getQueryScenario(req)).trim();
}

export function resolveRuntimeScenario(req: IncomingMessage): RuntimeScenario | null {
  const slug = getRequestedScenarioSlug(req);
  if (!slug) return null;

  if (!env.ENABLE_SCENARIO_SWITCHER) {
    return null;
  }

  const scenario = scenarioBySlug(slug);
  if (!scenario) {
    throw new Error(`Unknown scenario "${slug}"`);
  }

  const baseMongoUri = env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI;
  if (!baseMongoUri) {
    throw new Error('MONGODB_URI is required for scenario switching');
  }

  const dbName = getScenarioDbName(getDbName(baseMongoUri), scenario);
  return {
    slug: scenario.slug,
    label: scenario.label,
    now: scenario.now,
    dbName,
    mongodbUri: uriWithDbName(baseMongoUri, dbName),
  };
}
