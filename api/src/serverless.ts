import { app } from './app';
import { connectDB } from './config/db';
import { backfillCountryCodes } from './services/countryTeamService';

let seeded = false;

export default async function handler(req: any, res: any) {
  await connectDB();
  if (!seeded) {
    await backfillCountryCodes();
    seeded = true;
  }
  return app(req, res);
}
