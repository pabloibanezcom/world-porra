import axios from 'axios';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryTeam } from '../src/models/CountryTeam';
import { Match } from '../src/models/Match';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

let mongo: MongoMemoryServer | null = null;
let syncOdds: typeof import('../src/services/oddsService').syncOdds;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-with-enough-length';
  process.env.ODDS_API_KEY = 'test-odds-key';
  process.env.ODDS_API_SPORT_KEY = 'soccer_test';

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ syncOdds } = await import('../src/services/oddsService'));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  await CountryTeam.insertMany([
    { code: 'ARG', names: { en: 'Argentina', es: 'Argentina' } },
    { code: 'ESP', names: { en: 'Spain', es: 'Espana' } },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('syncOdds', () => {
  it('swaps home and away odds when the provider fixture is reversed', async () => {
    const kickoff = new Date('2026-06-11T19:00:00.000Z');
    await Match.create({
      externalId: 101,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: kickoff,
      status: 'SCHEDULED',
    });

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        {
          id: 'event-1',
          commence_time: kickoff.toISOString(),
          home_team: 'Spain',
          away_team: 'Argentina',
          bookmakers: [
            {
              key: 'book',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Spain', price: 1.7 },
                    { name: 'Draw', price: 3.4 },
                    { name: 'Argentina', price: 4.5 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      headers: { 'x-requests-remaining': '42' },
    });

    await expect(syncOdds({ force: true })).resolves.toEqual({ matchesUpdated: 1, requestsRemaining: 42 });

    const match = await Match.findOne({ externalId: 101 }).lean();
    expect(match?.odds).toMatchObject({
      home: 4.5,
      draw: 3.4,
      away: 1.7,
    });
  });
});
