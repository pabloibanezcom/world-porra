import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { User } from '../src/models/User';
import { processFinishedMatches, syncAllFixtures, syncMatchResults } from '../src/services/syncService';
import * as footballApi from '../src/services/footballApi';
import * as fotmobApi from '../src/services/fotmobApi';

function fotmobMatch(overrides: Partial<fotmobApi.FotmobMatch> = {}): fotmobApi.FotmobMatch {
  return {
    fotmobId: 4667751,
    utcTime: new Date('2026-06-11T19:00:00.000Z'),
    homeId: 100,
    awayId: 200,
    homeName: 'Argentina',
    awayName: 'Spain',
    homeScore: 3,
    awayScore: 1,
    started: true,
    finished: true,
    cancelled: false,
    eliminatedTeamId: null,
    ...overrides,
  };
}

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

describe('syncMatchResults (FotMob)', () => {
  it('maps a FotMob match to a stored match and applies the finished result', async () => {
    const match = await Match.create({
      externalId: 537400,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date('2026-06-11T19:00:00.000Z'),
      status: 'SCHEDULED',
      result: null,
    });

    vi.spyOn(fotmobApi, 'fetchWcMatches').mockResolvedValue([fotmobMatch()]);

    await expect(syncMatchResults()).resolves.toEqual({ matchesUpdated: 1, matchesUnmatched: 0 });

    const after = await Match.findById(match._id).lean();
    expect(after?.status).toBe('FINISHED');
    expect(after?.result).toMatchObject({ homeGoals: 3, awayGoals: 1, winner: 'HOME' });
    expect(after?.fotmobMatchId).toBe(4667751);
    expect(after?.scoresProcessed).toBe(false);

    vi.restoreAllMocks();
  });

  it('does not overwrite an admin-entered result', async () => {
    const match = await Match.create({
      externalId: 537401,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date('2026-06-11T19:00:00.000Z'),
      status: 'FINISHED',
      result: { homeGoals: 2, awayGoals: 2, winner: 'DRAW' },
      manualResult: true,
      scoresProcessed: true,
    });

    vi.spyOn(fotmobApi, 'fetchWcMatches').mockResolvedValue([fotmobMatch({ fotmobId: 999 })]);

    await syncMatchResults();

    const after = await Match.findById(match._id).lean();
    expect(after?.result).toMatchObject({ homeGoals: 2, awayGoals: 2, winner: 'DRAW' });
    expect(after?.scoresProcessed).toBe(true);

    vi.restoreAllMocks();
  });
});
