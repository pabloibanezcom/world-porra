import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  FOOTBALL_DATA_API_KEY: z.string().min(1, 'FOOTBALL_DATA_API_KEY is required'),
  SYNC_API_KEY: z.string().min(1, 'SYNC_API_KEY is required'),
});

export const env = envSchema.parse(process.env);
