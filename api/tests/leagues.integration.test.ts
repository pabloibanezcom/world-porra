import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Types } from 'mongoose';
import { League } from '../src/models/League';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
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

async function createLeague(token: string, name = 'Friends League') {
  const response = await requestJson<{ league: { _id: string; inviteCode: string } }>('/leagues', {
    token,
    body: { name },
  });
  expect(response.status).toBe(201);
  return response.body.league;
}

describe('league membership', () => {
  it('allows master and authorized users to create leagues and lets users join/list/read them', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');

    const forbidden = await requestJson('/leagues', {
      token: member.token,
      body: { name: 'Nope' },
    });
    expect(forbidden.status).toBe(403);

    const league = await createLeague(master.token);
    expect(league.inviteCode).toHaveLength(8);
    expect(league.inviteCode).toMatch(/^[A-Z2-9]+$/);

    await User.findByIdAndUpdate(member.user.id, { canCreateLeagues: true });
    const memberLeague = await createLeague(member.token, 'Member League');
    expect(memberLeague.inviteCode).toHaveLength(8);
    expect(memberLeague.inviteCode).toMatch(/^[A-Z2-9]+$/);

    const joined = await requestJson<{ league: { members: unknown[] } }>('/leagues/join', {
      token: member.token,
      body: { inviteCode: league.inviteCode.toLowerCase() },
    });
    expect(joined.status).toBe(200);
    expect(joined.body.league.members).toHaveLength(2);

    const duplicateJoin = await requestJson('/leagues/join', {
      token: member.token,
      body: { inviteCode: league.inviteCode },
    });
    expect(duplicateJoin.status).toBe(400);
    expect(duplicateJoin.body).toEqual({ error: 'You are already a member of this league' });

    const list = await requestJson<{ leagues: unknown[] }>('/leagues', { token: member.token });
    expect(list.status).toBe(200);
    expect(list.body.leagues).toHaveLength(2);

    const detail = await requestJson<{ league: { _id: string; members: unknown[] } }>(`/leagues/${league._id}`, {
      token: member.token,
    });
    expect(detail.status).toBe(200);
    expect(detail.body.league._id).toBe(league._id);
    expect(detail.body.league.members).toHaveLength(2);
  });

  it('closes league creation one day before the tournament kickoff', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    await Match.create({
      externalId: 600,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    });

    const closed = await requestJson('/leagues', {
      token: master.token,
      body: { name: 'Too Late' },
    });

    expect(closed.status).toBe(400);
    expect(closed.body).toEqual({ error: 'League creation is closed.' });
  });

  it('rejects missing leagues, full leagues, and non-member reads', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const outsider = await registerPlayer('outsider@worldporra.test', 'Outsider');
    const league = await createLeague(master.token);

    const fullLeague = await League.create({
      name: 'Full',
      inviteCode: 'ABC123',
      ownerId: master.user.id,
      maxMembers: 1,
      members: [{ userId: master.user.id, isAdmin: true }],
    });

    const missing = await requestJson('/leagues/join', {
      token: member.token,
      body: { inviteCode: 'NOPE00' },
    });
    expect(missing.status).toBe(404);

    const full = await requestJson('/leagues/join', {
      token: member.token,
      body: { inviteCode: fullLeague.inviteCode },
    });
    expect(full.status).toBe(400);
    expect(full.body).toEqual({ error: 'League is full' });

    const oversizedLeague = await League.create({
      name: 'Oversized',
      inviteCode: 'BIG050',
      ownerId: master.user.id,
      maxMembers: 50,
      members: [
        { userId: master.user.id, isAdmin: true },
        ...Array.from({ length: 49 }, () => ({ userId: new Types.ObjectId(), isAdmin: false })),
      ],
    });

    const hardCapFull = await requestJson('/leagues/join', {
      token: member.token,
      body: { inviteCode: oversizedLeague.inviteCode },
    });
    expect(hardCapFull.status).toBe(400);
    expect(hardCapFull.body).toEqual({ error: 'League is full' });

    const forbiddenDetail = await requestJson(`/leagues/${league._id}`, { token: outsider.token });
    expect(forbiddenDetail.status).toBe(403);
  });

  it('allows admins to promote/demote members and blocks invalid admin changes', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const outsider = await registerPlayer('outsider@worldporra.test', 'Outsider');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const nonAdmin = await requestJson(`/leagues/${league._id}/admins`, {
      token: member.token,
      body: { userId: member.user.id },
    });
    expect(nonAdmin.status).toBe(403);

    const nonMemberPromotion = await requestJson(`/leagues/${league._id}/admins`, {
      token: master.token,
      body: { userId: outsider.user.id },
    });
    expect(nonMemberPromotion.status).toBe(400);

    const promoted = await requestJson<{ league: { members: Array<{ userId: string; isAdmin: boolean }> } }>(
      `/leagues/${league._id}/admins`,
      { token: master.token, body: { userId: member.user.id } }
    );
    expect(promoted.status).toBe(200);
    expect(promoted.body.league.members.find((entry) => String(entry.userId) === member.user.id)?.isAdmin).toBe(true);

    const ownerDemotion = await requestJson(`/leagues/${league._id}/admins/${master.user.id}`, {
      method: 'DELETE',
      token: master.token,
    });
    expect(ownerDemotion.status).toBe(400);

    const demoted = await requestJson(`/leagues/${league._id}/admins/${member.user.id}`, {
      method: 'DELETE',
      token: master.token,
    });
    expect(demoted.status).toBe(200);
  });

  it('allows only league admins to notify league members', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const forbidden = await requestJson(`/leagues/${league._id}/notify`, {
      token: member.token,
      body: { title: 'Kickoff', body: 'Predictions close soon' },
    });
    expect(forbidden.status).toBe(403);

    const invalid = await requestJson(`/leagues/${league._id}/notify`, {
      token: master.token,
      body: { title: '', body: 'Predictions close soon' },
    });
    expect(invalid.status).toBe(400);

    const sent = await requestJson(`/leagues/${league._id}/notify`, {
      token: master.token,
      body: { title: 'Kickoff', body: 'Predictions close soon' },
    });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ ok: true });
  });

  it('lets non-owner members leave but keeps the owner in the league', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const ownerLeave = await requestJson(`/leagues/${league._id}/leave`, {
      method: 'DELETE',
      token: master.token,
    });
    expect(ownerLeave.status).toBe(400);

    const leave = await requestJson(`/leagues/${league._id}/leave`, {
      method: 'DELETE',
      token: member.token,
    });
    expect(leave.status).toBe(200);
    expect(leave.body).toEqual({ message: 'Left league successfully' });

    const stored = await League.findById(league._id).lean();
    expect(stored?.members.map((memberEntry) => String(memberEntry.userId))).toEqual([master.user.id]);
  });

  it('allows only the league owner to delete a league', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const forbidden = await requestJson(`/leagues/${league._id}`, {
      method: 'DELETE',
      token: member.token,
    });
    expect(forbidden.status).toBe(403);

    const deleted = await requestJson(`/leagues/${league._id}`, {
      method: 'DELETE',
      token: master.token,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ message: 'League deleted successfully' });

    await expect(League.findById(league._id).lean()).resolves.toBeNull();
  });
});

describe('league member prediction visibility', () => {
  it('returns finished predictions and upcoming pick status for league members only', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const outsider = await registerPlayer('outsider@worldporra.test', 'Outsider');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const finished = await Match.create({
      externalId: 701,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'FINISHED',
      result: { homeGoals: 2, awayGoals: 1, winner: 'HOME' },
    });
    const upcoming = await Match.create({
      externalId: 702,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'BRA',
      awayTeamCode: 'FRA',
      utcDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    });
    await Prediction.create([
      { userId: member.user.id, matchId: finished._id, homeGoals: 2, awayGoals: 1, predictedWinner: 'HOME', points: 10 },
      { userId: member.user.id, matchId: upcoming._id, homeGoals: 1, awayGoals: 1, predictedWinner: 'DRAW' },
    ]);

    const forbidden = await requestJson(`/leagues/${league._id}/members/${member.user.id}/predictions`, {
      token: outsider.token,
    });
    expect(forbidden.status).toBe(403);

    const response = await requestJson<{ finishedMatches: Array<{ prediction: { points: number } }>; upcomingMatches: Array<{ hasPick: boolean }> }>(
      `/leagues/${league._id}/members/${member.user.id}/predictions`,
      { token: master.token }
    );
    expect(response.status).toBe(200);
    expect(response.body.finishedMatches).toHaveLength(1);
    expect(response.body.finishedMatches[0].prediction.points).toBe(10);
    expect(response.body.upcomingMatches).toHaveLength(1);
    expect(response.body.upcomingMatches[0].hasPick).toBe(true);
  });
});
