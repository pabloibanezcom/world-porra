import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { GroupPrediction } from '../src/models/GroupPrediction';
import { League } from '../src/models/League';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { TournamentPrediction } from '../src/models/TournamentPrediction';
import { User } from '../src/models/User';

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

async function registerPlayer(email: string, name = 'Player') {
  const response = await requestJson<{ token: string; user: { id: string; email: string; isMaster: boolean } }>(
    '/auth/register',
    { body: { email, name, password: 'valid-password' } }
  );
  expect(response.status).toBe(201);
  return response.body;
}

describe('admin user management routes', () => {
  it('allows only master users to list users and exposes league-less accounts', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const orphan = await registerPlayer('orphan@worldporra.test', 'Orphan');

    const forbidden = await requestJson('/admin/users', { token: member.token });
    expect(forbidden.status).toBe(403);

    const league = await League.create({
      name: 'Friends',
      inviteCode: 'FRIENDS1',
      ownerId: master.user.id,
      members: [
        { userId: master.user.id, isAdmin: true },
        { userId: member.user.id, isAdmin: false },
      ],
    });

    const finishedMatch = await Match.create({
      externalId: 9001,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'BRA',
      homeTeam: { code: 'ARG', name: 'Argentina', crest: '' },
      awayTeam: { code: 'BRA', name: 'Brazil', crest: '' },
      utcDate: new Date('2026-06-12T20:00:00.000Z'),
      status: 'FINISHED',
      result: { homeGoals: 2, awayGoals: 1, winner: 'HOME' },
    });
    const scheduledMatch = await Match.create({
      externalId: 9002,
      stage: 'GROUP',
      group: 'A',
      matchday: 2,
      homeTeamCode: 'ESP',
      awayTeamCode: 'FRA',
      homeTeam: { code: 'ESP', name: 'Spain', crest: '' },
      awayTeam: { code: 'FRA', name: 'France', crest: '' },
      utcDate: new Date('2026-06-18T20:00:00.000Z'),
      status: 'SCHEDULED',
      result: null,
    });

    await Prediction.create({
      userId: member.user.id,
      matchId: finishedMatch._id,
      homeGoals: 2,
      awayGoals: 1,
      predictedWinner: 'HOME',
      points: 10,
    });
    await Prediction.create({
      userId: member.user.id,
      matchId: scheduledMatch._id,
      homeGoals: 3,
      awayGoals: 2,
      predictedWinner: 'HOME',
      points: null,
    });
    await GroupPrediction.create({
      userId: member.user.id,
      group: 'A',
      orderedTeamCodes: ['ARG', 'BRA', 'ESP', 'FRA'],
      points: null,
    });
    await TournamentPrediction.create({
      userId: member.user.id,
      championCode: 'ARG',
      runnerUpCode: 'BRA',
    });
    const deviceHeartbeat = await requestJson('/devices/heartbeat', {
      token: member.token,
      body: {
        deviceId: 'device-member-web',
        displayMode: 'browser',
        platform: 'web',
        userAgent: 'Mozilla/5.0 Chrome/120',
        browserLanguage: 'en-US',
      },
    });
    expect(deviceHeartbeat.status).toBe(200);
    const updatedDeviceHeartbeat = await requestJson('/devices/heartbeat', {
      token: member.token,
      body: {
        deviceId: 'device-member-web',
        displayMode: 'standalone',
        platform: 'web',
        userAgent: 'Mozilla/5.0 Chrome/121',
        browserLanguage: 'en-GB',
      },
    });
    expect(updatedDeviceHeartbeat.status).toBe(200);

    const list = await requestJson<{ users: Array<{ id: string; email: string; leagueCount: number; predictionCount: number; leagues: unknown[] }> }>(
      '/admin/users',
      { token: master.token }
    );
    expect(list.status).toBe(200);
    expect(list.body.users).toHaveLength(3);

    const orphanSummary = list.body.users.find((user) => user.id === orphan.user.id);
    expect(orphanSummary).toMatchObject({
      email: 'orphan@worldporra.test',
      leagueCount: 0,
      predictionCount: 0,
      leagues: [],
    });

    const memberSummary = list.body.users.find((user) => user.id === member.user.id);
    expect(memberSummary).toMatchObject({
      email: 'member@worldporra.test',
      leagueCount: 1,
      predictionCount: 2,
    });

    const search = await requestJson<{ users: Array<{ email: string }> }>('/admin/users?search=orph', {
      token: master.token,
    });
    expect(search.status).toBe(200);
    expect(search.body.users.map((user) => user.email)).toEqual(['orphan@worldporra.test']);

    const detail = await requestJson<any>(`/admin/users/${member.user.id}`, { token: master.token });
    expect(detail.status).toBe(200);
    expect(detail.body.user.leagues[0]).toMatchObject({
      _id: String(league._id),
      name: 'Friends',
      inviteCode: 'FRIENDS1',
    });
    expect(detail.body.predictions).toMatchObject({
      total: 2,
      scored: 1,
      pending: 1,
    });
    const finishedPick = detail.body.predictions.recent.find((prediction: any) => prediction.matchId === String(finishedMatch._id));
    const scheduledPick = detail.body.predictions.recent.find((prediction: any) => prediction.matchId === String(scheduledMatch._id));
    expect(finishedPick).toMatchObject({
      hasPrediction: true,
      isRevealed: true,
      homeGoals: 2,
      awayGoals: 1,
      points: 10,
      match: {
        stage: 'GROUP',
        status: 'FINISHED',
        group: 'A',
        homeTeam: { code: 'ARG', name: 'Argentina', crest: '' },
        awayTeam: { code: 'BRA', name: 'Brazil', crest: '' },
      },
    });
    expect(scheduledPick).toMatchObject({
      hasPrediction: true,
      isRevealed: false,
      match: {
        stage: 'GROUP',
        status: 'SCHEDULED',
      },
    });
    expect(scheduledPick.homeGoals).toBeUndefined();
    expect(scheduledPick.awayGoals).toBeUndefined();
    expect(scheduledPick.qualifier).toBeUndefined();
    expect(scheduledPick.points).toBeUndefined();
    expect(detail.body.groupPredictions).toHaveLength(1);
    expect(detail.body.groupPredictions[0]).toMatchObject({
      group: 'A',
      hasPrediction: true,
      isRevealed: false,
    });
    expect(detail.body.groupPredictions[0].orderedTeamCodes).toBeUndefined();
    expect(detail.body.groupPredictions[0].points).toBeUndefined();
    expect(detail.body.tournamentPrediction).toMatchObject({
      hasPrediction: true,
    });
    expect(detail.body.tournamentPrediction.championCode).toBeUndefined();
    expect(detail.body.tournamentPrediction.runnerUpCode).toBeUndefined();
    expect(detail.body.tournamentPrediction.bestPlayer).toBeUndefined();
    expect(detail.body.devices).toHaveLength(1);
    expect(detail.body.devices[0]).toMatchObject({
      deviceId: 'device-member-web',
      displayMode: 'standalone',
      platform: 'web',
      userAgent: 'Mozilla/5.0 Chrome/121',
      browserLanguage: 'en-GB',
    });

    await Match.findByIdAndUpdate(scheduledMatch._id, {
      status: 'FINISHED',
      result: { homeGoals: 1, awayGoals: 1, winner: 'DRAW' },
    });
    const completeDetail = await requestJson<any>(`/admin/users/${member.user.id}`, { token: master.token });
    expect(completeDetail.status).toBe(200);
    expect(completeDetail.body.groupPredictions[0]).toMatchObject({
      group: 'A',
      hasPrediction: true,
      isRevealed: true,
      orderedTeamCodes: ['ARG', 'BRA', 'ESP', 'FRA'],
      points: null,
    });
  });

  it('returns 404 for missing user details', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');

    const response = await requestJson('/admin/users/665000000000000000000000', { token: master.token });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'User not found' });
  });
});
