import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false' || normalized === '') return false;
  }

  return value;
}, z.boolean().default(false));

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000'),
  MONGODB_URI: z.string().default(''),
  USE_IN_MEMORY_DB: envBoolean,
  SEED_DEV_DATA: envBoolean,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  MASTER_USER_EMAIL: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  FOOTBALL_DATA_API_KEY: z.string().default(''),
  TOURNAMENT_NOW: z.string().default(''),
  POLL_PICKS_DEADLINE: z.string().default(''),
  POLL_GROUP_PREDICTIONS_DEADLINE: z.string().default(''),
  POLL_TOURNAMENT_PREDICTIONS_DEADLINE: z.string().default(''),
  ENABLE_SCENARIO_SWITCHER: envBoolean,
  SCENARIO_BASE_MONGODB_URI: z.string().default(''),
  ODDS_API_KEY: z.string().default(''),
  ODDS_API_SPORT_KEY: z.string().default('soccer_fifa_world_cup'),
  LIVE_SCORE_CACHE_SECONDS: z.coerce.number().int().positive().default(60),
  MOCK_LIVE_SCORES: envBoolean,
  SYNC_API_KEY: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_EMAIL: z.string().default(''),
});

export const env = envSchema.parse(process.env);
