import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { GroupPrediction } from '../src/models/GroupPrediction';
import { User } from '../src/models/User';
import {
  BRACKET_FIXTURE_DAYS_FORWARD,
  LIVE_RESULTS_DAYS_BACK,
  processFinishedMatches,
  syncAllFixtures,
  syncMatchResults,
} from '../src/services/syncService';
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
      groupPredictionsScored: 0,
      leaguesUpdated: 1,
    });

    const scoredPrediction = await Prediction.findById(prediction._id).lean();
    const updatedUser = await User.findById(user._id).lean();
    const processedMatch = await Match.findById(match._id).lean();

    expect(scoredPrediction?.points).toBe(5);
    expect(updatedUser?.totalPoints).toBe(5);
    expect(processedMatch?.scoresProcessed).toBe(true);
  });

  it('doubles the points of a jokered prediction', async () => {
    const user = await User.create({
      email: 'joker@worldporra.test',
      name: 'Joker',
    });
    const match = await Match.create({
      externalId: 203,
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
      joker: true,
    });

    await processFinishedMatches();

    const scoredPrediction = await Prediction.findById(prediction._id).lean();
    // Same prediction scores 5 without a joker; the joker doubles it to 10.
    expect(scoredPrediction?.points).toBe(10);
  });

  it('scores group predictions as soon as that group is complete', async () => {
    const user = await User.create({
      email: 'groups@worldporra.test',
      name: 'Groups',
    });
    await Match.create([
      {
        externalId: 204,
        stage: 'GROUP',
        group: 'B',
        matchday: 1,
        homeTeamCode: 'ARG',
        awayTeamCode: 'ESP',
        utcDate: new Date('2026-06-12T19:00:00.000Z'),
        status: 'FINISHED',
        result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
        scoresProcessed: false,
      },
      {
        externalId: 205,
        stage: 'GROUP',
        group: 'B',
        matchday: 1,
        homeTeamCode: 'BRA',
        awayTeamCode: 'FRA',
        utcDate: new Date('2026-06-12T22:00:00.000Z'),
        status: 'FINISHED',
        result: { homeGoals: 1, awayGoals: 1, winner: 'DRAW' },
        scoresProcessed: false,
      },
    ]);
    const groupPrediction = await GroupPrediction.create({
      userId: user._id,
      group: 'B',
      orderedTeamCodes: ['ARG', 'BRA', 'FRA', 'ESP'],
    });

    await expect(processFinishedMatches()).resolves.toEqual({
      matchesProcessed: 2,
      predictionsScored: 0,
      groupPredictionsScored: 1,
      leaguesUpdated: 1,
    });

    const scoredGroupPrediction = await GroupPrediction.findById(groupPrediction._id).lean();
    const updatedUser = await User.findById(user._id).lean();

    expect(scoredGroupPrediction?.points).toBe(25);
    expect(updatedUser?.totalPoints).toBe(25);
  });

  it('does not score group predictions while that group still has unfinished matches', async () => {
    const user = await User.create({
      email: 'pending-group@worldporra.test',
      name: 'Pending Group',
    });
    await Match.create([
      {
        externalId: 206,
        stage: 'GROUP',
        group: 'C',
        matchday: 1,
        homeTeamCode: 'ARG',
        awayTeamCode: 'ESP',
        utcDate: new Date('2026-06-13T19:00:00.000Z'),
        status: 'FINISHED',
        result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
        scoresProcessed: false,
      },
      {
        externalId: 207,
        stage: 'GROUP',
        group: 'C',
        matchday: 1,
        homeTeamCode: 'BRA',
        awayTeamCode: 'FRA',
        utcDate: new Date('2026-06-13T22:00:00.000Z'),
        status: 'SCHEDULED',
        result: null,
        scoresProcessed: false,
      },
    ]);
    const groupPrediction = await GroupPrediction.create({
      userId: user._id,
      group: 'C',
      orderedTeamCodes: ['ARG', 'BRA', 'FRA', 'ESP'],
    });

    await expect(processFinishedMatches()).resolves.toEqual({
      matchesProcessed: 1,
      predictionsScored: 0,
      groupPredictionsScored: 0,
      leaguesUpdated: 0,
    });

    const unscoredGroupPrediction = await GroupPrediction.findById(groupPrediction._id).lean();
    const updatedUser = await User.findById(user._id).lean();

    expect(unscoredGroupPrediction?.points).toBeNull();
    expect(updatedUser?.totalPoints).toBe(0);
  });

  it('backfills completed group prediction points through the admin action', async () => {
    const user = await User.create({
      email: 'backfill-groups@worldporra.test',
      name: 'Backfill Groups',
    });
    await Match.create([
      {
        externalId: 208,
        stage: 'GROUP',
        group: 'D',
        matchday: 1,
        homeTeamCode: 'ARG',
        awayTeamCode: 'ESP',
        utcDate: new Date('2026-06-14T19:00:00.000Z'),
        status: 'FINISHED',
        result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
        scoresProcessed: true,
      },
      {
        externalId: 209,
        stage: 'GROUP',
        group: 'D',
        matchday: 1,
        homeTeamCode: 'BRA',
        awayTeamCode: 'FRA',
        utcDate: new Date('2026-06-14T22:00:00.000Z'),
        status: 'FINISHED',
        result: { homeGoals: 1, awayGoals: 1, winner: 'DRAW' },
        scoresProcessed: true,
      },
    ]);
    const groupPrediction = await GroupPrediction.create({
      userId: user._id,
      group: 'D',
      orderedTeamCodes: ['ARG', 'BRA', 'FRA', 'ESP'],
    });

    const response = await requestJson<{
      ok: boolean;
      groupPredictionsScored: number;
      usersUpdated: number;
      groups: Array<{ group: string; complete: boolean; predictionsScored: number }>;
    }>('/admin/score-group-predictions', {
      headers: { 'x-sync-api-key': 'test-sync-key' },
      body: { groups: ['D'] },
    });

    const scoredGroupPrediction = await GroupPrediction.findById(groupPrediction._id).lean();
    const updatedUser = await User.findById(user._id).lean();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      groupPredictionsScored: 1,
      usersUpdated: 1,
      groups: [{ group: 'D', complete: true, predictionsScored: 1 }],
    });
    expect(scoredGroupPrediction?.points).toBe(25);
    expect(updatedUser?.totalPoints).toBe(25);
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

  it('looks ahead for confirmed knockout fixtures and backfills their teams', async () => {
    const kickoff = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const match = await Match.create({
      externalId: 537500,
      stage: 'ROUND_OF_32',
      group: null,
      matchday: 4,
      homeTeamCode: 'TBD',
      awayTeamCode: 'TBD',
      utcDate: kickoff,
      status: 'SCHEDULED',
      result: null,
    });

    const fetchSpy = vi.spyOn(fotmobApi, 'fetchWcMatches').mockResolvedValue([
      fotmobMatch({
        fotmobId: 4667800,
        utcTime: kickoff,
        homeName: 'Argentina',
        awayName: 'Spain',
        homeScore: null,
        awayScore: null,
        started: false,
        finished: false,
      }),
    ]);

    await expect(syncMatchResults()).resolves.toEqual({ matchesUpdated: 1, matchesUnmatched: 0 });

    expect(fetchSpy).toHaveBeenCalledWith(LIVE_RESULTS_DAYS_BACK, BRACKET_FIXTURE_DAYS_FORWARD);
    const after = await Match.findById(match._id).lean();
    expect(after?.homeTeamCode).toBe('ARG');
    expect(after?.awayTeamCode).toBe('ESP');
    expect(after?.status).toBe('SCHEDULED');
    expect(after?.result).toBeNull();

    vi.restoreAllMocks();
  });

  it('maps Curaçao vs Côte d’Ivoire when multiple matches share a kickoff time', async () => {
    const kickoff = new Date('2026-06-25T22:00:00.000Z');
    const match = await Match.create({
      externalId: 537402,
      stage: 'GROUP',
      group: 'A',
      matchday: 3,
      homeTeamCode: 'CUW',
      awayTeamCode: 'CIV',
      utcDate: kickoff,
      status: 'SCHEDULED',
      result: null,
    });
    await Match.create({
      externalId: 537403,
      stage: 'GROUP',
      group: 'A',
      matchday: 3,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: kickoff,
      status: 'SCHEDULED',
      result: null,
    });

    vi.spyOn(fotmobApi, 'fetchWcMatches').mockResolvedValue([
      fotmobMatch({
        fotmobId: 4667752,
        utcTime: kickoff,
        homeName: 'Curacao',
        awayName: "Côte d'Ivoire",
        homeScore: 0,
        awayScore: 1,
      }),
    ]);

    await expect(syncMatchResults()).resolves.toEqual({ matchesUpdated: 1, matchesUnmatched: 0 });

    const after = await Match.findById(match._id).lean();
    expect(after?.status).toBe('FINISHED');
    expect(after?.result).toMatchObject({ homeGoals: 0, awayGoals: 1, winner: 'AWAY' });
    expect(after?.fotmobMatchId).toBe(4667752);

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
