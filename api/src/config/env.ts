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
  SYNC_API_KEY: z.string().default(''),
});

export const env = envSchema.parse(process.env);
