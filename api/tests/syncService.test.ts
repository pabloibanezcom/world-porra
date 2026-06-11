import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { User } from '../src/models/User';
import { processFinishedMatches, syncAllFixtures } from '../src/services/syncService';
import * as footballApi from '../src/services/footballApi';

vi.mock('../src/services/pushService', () => ({
  sendToUser: vi.fn().mockResolvedValue(undefined),
  sendToAll: vi.fn().mockResolvedValue(undefined),
  sendToUsers: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
  await seedTestCountryTeams();
});

afterAll(async () => {
  await stopIntegrationServer();
});

describe('processFinishedMatches', () => {
  it('scores predictions with the stored match odds and updates user totals', async () => {
    const user = await User.create({
      email: 'player@worldporra.test',
      name: 'Player',
    });
    const match = await Match.create({
      externalId: 202,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date('2026-06-11T19:00:00.000Z'),
      status: 'FINISHED',
      result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
      odds: { home: 2.25, draw: 3.4, away: 4.5, fetchedAt: new Date() },
      scoresProcessed: false,
    });
    const prediction = await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      predictedWinner: 'HOME',
    });

    await expect(processFinishedMatches()).resolves.toEqual({
      matchesProcessed: 1,
      predictionsScored: 1,
      leaguesUpdated: 1,
    });

    const scoredPrediction = await Prediction.findById(prediction._id).lean();
    const updatedUser = await User.findById(user._id).lean();
    const processedMatch = await Match.findById(match._id).lean();

    expect(scoredPrediction?.points).toBe(5);
    expect(updatedUser?.totalPoints).toBe(5);
    expect(processedMatch?.scoresProcessed).toBe(true);
  });
});

describe('syncAllFixtures', () => {
  it('does not overwrite a manually-entered result when the feed reports no score', async () => {
    const match = await Match.create({
      externalId: 537327,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'MEX',
      awayTeamCode: 'RSA',
      utcDate: new Date('2026-06-11T19:00:00.000Z'),
      status: 'FINISHED',
      result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
      scoresProcessed: true,
      manualResult: true,
    });

    // football-data reports the match FINISHED but with a null score — the exact
    // situation that previously wiped the manual result on the next sync.
    vi.spyOn(footballApi, 'fetchAllMatches').mockResolvedValue([
      {
        id: 537327,
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        matchday: 1,
        homeTeam: { name: 'Mexico', tla: 'MEX', crest: '' },
        awayTeam: { name: 'South Africa', tla: 'RSA', crest: '' },
        utcDate: '2026-06-11T19:00:00Z',
        status: 'FINISHED',
        score: { fullTime: { home: null, away: null }, winner: null },
      },
    ] as any);

    await syncAllFixtures();

    const after = await Match.findById(match._id).lean();
    expect(after?.status).toBe('FINISHED');
    expect(after?.result).toMatchObject({ homeGoals: 2, awayGoals: 0, winner: 'HOME' });
    expect(after?.manualResult).toBe(true);

    vi.restoreAllMocks();
  });
});
