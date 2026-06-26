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

    expect(axios.get).toHaveBeenCalledWith(expect.any(String), {
      params: expect.objectContaining({
        commenceTimeFrom: '2026-06-11T17:00:00Z',
        commenceTimeTo: '2026-06-11T21:00:00Z',
      }),
    });

    const match = await Match.findOne({ externalId: 101 }).lean();
    expect(match?.odds).toMatchObject({
      home: 4.5,
      draw: 3.4,
      away: 1.7,
    });
  });

  it('returns quota details without throwing when the provider rejects the odds request', async () => {
    await Match.create({
      externalId: 102,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date('2026-06-11T19:00:00.000Z'),
      status: 'SCHEDULED',
    });

    vi.mocked(axios.get).mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error_code: 'INVALID_COMMENCE_TIME_FROM',
          message: 'Invalid commenceTimeFrom parameter.',
        },
        headers: { 'x-requests-remaining': '500' },
      },
    });

    await expect(syncOdds({ force: true })).resolves.toEqual({ matchesUpdated: 0, requestsRemaining: 500 });
  });

  it('refreshes fresh knockout placeholder odds and derives two-way advancing odds from 1X2 odds', async () => {
    const kickoff = new Date('2026-06-28T19:00:00.000Z');
    await Match.create({
      externalId: 103,
      stage: 'ROUND_OF_32',
      group: null,
      matchday: 4,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: kickoff,
      status: 'SCHEDULED',
      odds: { home: 2.58, draw: 3.32, away: 2.58, fetchedAt: new Date() },
    });

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        {
          id: 'event-2',
          commence_time: kickoff.toISOString(),
          home_team: 'Argentina',
          away_team: 'Spain',
          bookmakers: [
            {
              key: 'book',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Argentina', price: 2.0 },
                    { name: 'Draw', price: 3.5 },
                    { name: 'Spain', price: 4.0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      headers: { 'x-requests-remaining': '41' },
    });

    await expect(syncOdds()).resolves.toEqual({ matchesUpdated: 1, requestsRemaining: 41 });

    const match = await Match.findOne({ externalId: 103 }).lean();
    expect(match?.odds).toMatchObject({
      home: 1.5,
      draw: null,
      away: 3,
    });
  });

  it('stores odds without validating unrelated legacy match fields', async () => {
    const kickoff = new Date('2026-06-28T22:00:00.000Z');
    const match = await Match.create({
      externalId: 104,
      stage: 'ROUND_OF_32',
      group: null,
      matchday: 4,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: kickoff,
      status: 'SCHEDULED',
      odds: null,
    });
    await Match.updateOne({ _id: match._id }, { $set: { matchday: null } });

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        {
          id: 'event-3',
          commence_time: kickoff.toISOString(),
          home_team: 'Argentina',
          away_team: 'Spain',
          bookmakers: [
            {
              key: 'book',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Argentina', price: 1.8 },
                    { name: 'Spain', price: 2.2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      headers: { 'x-requests-remaining': '40' },
    });

    await expect(syncOdds()).resolves.toEqual({ matchesUpdated: 1, requestsRemaining: 40 });

    const updated = await Match.findOne({ externalId: 104 }).lean();
    expect(updated?.matchday).toBeNull();
    expect(updated?.odds).toMatchObject({
      home: 1.8,
      draw: null,
      away: 2.2,
    });
  });
});
