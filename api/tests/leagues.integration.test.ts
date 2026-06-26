import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Types } from 'mongoose';
import { League } from '../src/models/League';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { GroupPrediction } from '../src/models/GroupPrediction';
import { TournamentPrediction } from '../src/models/TournamentPrediction';
import { PushSubscription } from '../src/models/PushSubscription';
import { UserDevice } from '../src/models/UserDevice';

const pushMocks = vi.hoisted(() => ({
  sendToUsers: vi.fn().mockResolvedValue(undefined),
}));

const emailMocks = vi.hoisted(() => ({
  sendMissingPickReminderEmails: vi.fn().mockResolvedValue({
    attempted: 1,
    sent: 1,
    skippedAlreadySent: 0,
    skippedQuota: 0,
    skippedNotConfigured: 0,
    failed: 0,
  }),
}));

vi.mock('../src/services/pushService', () => pushMocks);
vi.mock('../src/services/emailService', () => emailMocks);

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
  await seedTestCountryTeams();
  vi.clearAllMocks();
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

async function createStoredLeague(ownerId: string, name: string, inviteCode: string) {
  return League.create({
    name,
    inviteCode,
    ownerId,
    maxMembers: 50,
    members: [{ userId: ownerId, isAdmin: true, hasPaid: false }],
  });
}

describe('league membership', () => {
  it('allows any user to create one league as admin and lets users join/list/read it', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    pushMocks.sendToUsers.mockClear();

    const memberLeague = await requestJson<{ league: { _id: string; inviteCode: string; members: Array<{ userId: string; isAdmin: boolean }> } }>('/leagues', {
      token: member.token,
      body: { name: 'Member League' },
    });
    expect(memberLeague.status).toBe(201);
    expect(memberLeague.body.league.inviteCode).toHaveLength(8);
    expect(memberLeague.body.league.inviteCode).toMatch(/^[A-Z2-9]+$/);
    expect(memberLeague.body.league.members.find((entry) => String(entry.userId) === member.user.id)?.isAdmin).toBe(true);
    expect(pushMocks.sendToUsers).toHaveBeenCalledWith([master.user.id], {
      title: 'New league created',
      body: 'Member created Member League.',
      url: '/',
    });

    const duplicateOwnedLeague = await requestJson('/leagues', {
      token: member.token,
      body: { name: 'Another Member League' },
    });
    expect(duplicateOwnedLeague.status).toBe(403);
    expect(duplicateOwnedLeague.body).toEqual({ error: 'You can only create one league' });

    const league = await createLeague(master.token);
    expect(league.inviteCode).toHaveLength(8);
    expect(league.inviteCode).toMatch(/^[A-Z2-9]+$/);

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

  it('persists the current user league order and returns leagues in that order', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const first = await createStoredLeague(master.user.id, 'First League', 'ORDERA1');
    const second = await createStoredLeague(master.user.id, 'Second League', 'ORDERB2');
    const third = await createStoredLeague(master.user.id, 'Third League', 'ORDERC3');

    const reordered = await requestJson<{ leagues: Array<{ _id: string; name: string }> }>('/leagues/order', {
      method: 'PATCH',
      token: master.token,
      body: { leagueIds: [String(third._id), String(first._id), String(second._id)] },
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body.leagues.map((league) => league._id)).toEqual([String(third._id), String(first._id), String(second._id)]);

    const listed = await requestJson<{ leagues: Array<{ _id: string; name: string }> }>('/leagues', {
      token: master.token,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.leagues.map((league) => league._id)).toEqual([String(third._id), String(first._id), String(second._id)]);

    const duplicate = await requestJson('/leagues/order', {
      method: 'PATCH',
      token: master.token,
      body: { leagueIds: [String(first._id), String(first._id)] },
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: 'League order cannot contain duplicates' });
  });

  it('lets master users silently manage leagues without being members', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const owner = await registerPlayer('owner@worldporra.test', 'Owner');

    const ownedByMaster = await createLeague(master.token, 'Original Master League');
    await requestJson(`/leagues/${ownedByMaster._id}/leave`, {
      method: 'DELETE',
      token: master.token,
    });

    const masterOwnedDetail = await requestJson<{ league: { members: Array<{ userId: { _id: string } }> } }>(
      `/leagues/${ownedByMaster._id}`,
      { token: master.token }
    );
    expect(masterOwnedDetail.status).toBe(200);
    expect(masterOwnedDetail.body.league.members.map((entry) => String(entry.userId._id))).not.toContain(master.user.id);

    const ownerLeague = await createLeague(owner.token, 'Owner League');
    const masterList = await requestJson<{ leagues: Array<{ _id: string; members: unknown[] }> }>('/leagues', {
      token: master.token,
    });
    expect(masterList.status).toBe(200);
    expect(masterList.body.leagues.map((league) => league._id)).toEqual(
      expect.arrayContaining([ownedByMaster._id, ownerLeague._id])
    );

    const detail = await requestJson<{ league: { members: Array<{ userId: { _id: string }; hasPaid: boolean }> } }>(
      `/leagues/${ownerLeague._id}`,
      { token: master.token }
    );
    expect(detail.status).toBe(200);
    expect(detail.body.league.members).toHaveLength(1);
    expect(detail.body.league.members.map((entry) => String(entry.userId._id))).not.toContain(master.user.id);

    const updatedSettings = await requestJson(`/leagues/${ownerLeague._id}/payments`, {
      method: 'PATCH',
      token: master.token,
      body: {
        entryFee: 25,
        payoutSplits: [{ position: 1, amount: 25 }],
      },
    });
    expect(updatedSettings.status).toBe(200);

    const paid = await requestJson<{ league: { members: Array<{ userId: { _id: string }; hasPaid: boolean }> } }>(
      `/leagues/${ownerLeague._id}/members/${owner.user.id}/payment`,
      { method: 'PATCH', token: master.token, body: { hasPaid: true } }
    );
    expect(paid.status).toBe(200);
    expect(paid.body.league.members.find((entry) => String(entry.userId._id) === owner.user.id)?.hasPaid).toBe(true);
  });

  it('returns a public league invite preview by invite code', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const league = await createLeague(master.token, 'Office Champions');

    const preview = await requestJson<{ league: { name: string; inviteCode: string } }>(
      `/leagues/invite/${league.inviteCode.toLowerCase()}`
    );

    expect(preview.status).toBe(200);
    expect(preview.body.league).toEqual({
      name: 'Office Champions',
      inviteCode: league.inviteCode,
    });
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

    const legacyLowercaseLeague = await League.create({
      name: 'Legacy Code',
      inviteCode: 'nvr4lpjp',
      ownerId: master.user.id,
      members: [{ userId: master.user.id, isAdmin: true }],
    });

    const legacyJoin = await requestJson<{ league: { _id: string } }>('/leagues/join', {
      token: member.token,
      body: { inviteCode: 'NVR4LPJP' },
    });
    expect(legacyJoin.status).toBe(200);
    expect(legacyJoin.body.league._id).toBe(String(legacyLowercaseLeague._id));

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

  it('allows admins to set payment rules before kickoff and track paid members', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const invalidSplit = await requestJson(`/leagues/${league._id}/payments`, {
      method: 'PATCH',
      token: master.token,
      body: {
        entryFee: 25,
        payoutSplits: [
          { position: 1, amount: 40 },
          { position: 2, amount: 20 },
        ],
      },
    });
    expect(invalidSplit.status).toBe(400);

    const updatedSettings = await requestJson<{
      league: { paymentSettings: { entryFee: number; payoutSplits: Array<{ position: number; amount: number }> } };
    }>(`/leagues/${league._id}/payments`, {
      method: 'PATCH',
      token: master.token,
      body: {
        entryFee: 25,
        payoutSplits: [
          { position: 1, amount: 35 },
          { position: 2, amount: 10 },
          { position: 3, amount: 5 },
        ],
      },
    });
    expect(updatedSettings.status).toBe(200);
    expect(updatedSettings.body.league.paymentSettings).toMatchObject({
      entryFee: 25,
      payoutSplits: [
        { position: 1, amount: 35 },
        { position: 2, amount: 10 },
        { position: 3, amount: 5 },
      ],
    });

    const nonAdminPayment = await requestJson(`/leagues/${league._id}/members/${master.user.id}/payment`, {
      method: 'PATCH',
      token: member.token,
      body: { hasPaid: true },
    });
    expect(nonAdminPayment.status).toBe(403);

    const paid = await requestJson<{ league: { members: Array<{ userId: { _id: string }; hasPaid: boolean; paidAt: string | null }> } }>(
      `/leagues/${league._id}/members/${member.user.id}/payment`,
      { method: 'PATCH', token: master.token, body: { hasPaid: true } }
    );
    expect(paid.status).toBe(200);
    const paidMember = paid.body.league.members.find((entry) => String(entry.userId._id) === member.user.id);
    expect(paidMember?.hasPaid).toBe(true);
    expect(paidMember?.paidAt).toBeTruthy();
  });

  it('allows admins to remind unpaid members only', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const paidMember = await registerPlayer('paid@worldporra.test', 'Paid');
    const unpaidMember = await registerPlayer('unpaid@worldporra.test', 'Unpaid');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: paidMember.token, body: { inviteCode: league.inviteCode } });
    await requestJson('/leagues/join', { token: unpaidMember.token, body: { inviteCode: league.inviteCode } });

    const forbidden = await requestJson(`/leagues/${league._id}/payments/remind-unpaid`, {
      token: unpaidMember.token,
      body: {},
    });
    expect(forbidden.status).toBe(403);

    await requestJson(`/leagues/${league._id}/members/${master.user.id}/payment`, {
      method: 'PATCH',
      token: master.token,
      body: { hasPaid: true },
    });
    await requestJson(`/leagues/${league._id}/members/${paidMember.user.id}/payment`, {
      method: 'PATCH',
      token: master.token,
      body: { hasPaid: true },
    });

    const reminded = await requestJson<{ ok: true; recipients: number }>(
      `/leagues/${league._id}/payments/remind-unpaid`,
      { token: master.token, body: {} }
    );
    expect(reminded.status).toBe(200);
    expect(reminded.body).toEqual({ ok: true, recipients: 1 });
    expect(pushMocks.sendToUsers).toHaveBeenCalledWith(
      [unpaidMember.user.id],
      expect.objectContaining({
        title: 'Friends League: payment reminder',
        url: '/',
      })
    );

    const repeated = await requestJson(`/leagues/${league._id}/payments/remind-unpaid`, {
      token: master.token,
      body: {},
    });
    expect(repeated.status).toBe(429);
    expect(repeated.body).toMatchObject({ error: 'Payment reminders were sent recently' });

    await requestJson(`/leagues/${league._id}/members/${unpaidMember.user.id}/payment`, {
      method: 'PATCH',
      token: master.token,
      body: { hasPaid: true },
    });
    const allPaid = await requestJson(`/leagues/${league._id}/payments/remind-unpaid`, {
      token: master.token,
      body: {},
    });
    expect(allPaid.status).toBe(400);
    expect(allPaid.body).toEqual({ error: 'All league members are marked as paid' });
  });

  it('allows admins to remind members missing picks for matches locking soon', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const pickedMember = await registerPlayer('picked@worldporra.test', 'Picked');
    const missingMember = await registerPlayer('missing@worldporra.test', 'Missing');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: pickedMember.token, body: { inviteCode: league.inviteCode } });
    await requestJson('/leagues/join', { token: missingMember.token, body: { inviteCode: league.inviteCode } });

    const match = await Match.create({
      externalId: 660,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    });
    await Match.create({
      externalId: 661,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'BRA',
      awayTeamCode: 'FRA',
      utcDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    });

    await Prediction.create([
      { userId: master.user.id, matchId: match._id, homeGoals: 1, awayGoals: 0, predictedWinner: 'HOME' },
      { userId: pickedMember.user.id, matchId: match._id, homeGoals: 1, awayGoals: 1, predictedWinner: 'DRAW' },
    ]);

    const forbidden = await requestJson(`/leagues/${league._id}/picks/remind-missing`, {
      token: missingMember.token,
      body: {},
    });
    expect(forbidden.status).toBe(403);

    const forbiddenPreview = await requestJson(`/leagues/${league._id}/picks/remind-missing/preview`, {
      token: missingMember.token,
    });
    expect(forbiddenPreview.status).toBe(403);

    const preview = await requestJson<{
      matches: number;
      recipients: number;
      members: Array<{ id: string; name: string; avatarUrl: string }>;
    }>(`/leagues/${league._id}/picks/remind-missing/preview`, { token: master.token });
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      matches: 1,
      recipients: 1,
      emailFallbackRecipients: 1,
      members: [{ id: missingMember.user.id, name: 'Missing', avatarUrl: '' }],
    });

    const reminded = await requestJson<{
      ok: true;
      recipients: number;
      matches: number;
      pushRecipients: number;
      emailRecipients: number;
      emailSkipped: number;
    }>(
      `/leagues/${league._id}/picks/remind-missing`,
      { token: master.token, body: {} }
    );
    expect(reminded.status).toBe(200);
    expect(reminded.body).toEqual({
      ok: true,
      recipients: 1,
      matches: 1,
      pushRecipients: 1,
      emailRecipients: 1,
      emailSkipped: 0,
    });
    expect(pushMocks.sendToUsers).toHaveBeenCalledWith(
      [missingMember.user.id],
      expect.objectContaining({
        title: 'Friends League: picks reminder',
        url: '/',
      })
    );
    expect(emailMocks.sendMissingPickReminderEmails).toHaveBeenCalledWith({
      recipients: [{ userId: missingMember.user.id, email: 'missing@worldporra.test', name: 'Missing' }],
      leagueName: 'Friends League',
      matchCount: 1,
      dedupeKey: String(match._id),
    });

    const repeated = await requestJson(`/leagues/${league._id}/picks/remind-missing`, {
      token: master.token,
      body: {},
    });
    expect(repeated.status).toBe(429);
    expect(repeated.body).toMatchObject({ error: 'Pick reminders were sent recently' });

    await Prediction.create({
      userId: missingMember.user.id,
      matchId: match._id,
      homeGoals: 2,
      awayGoals: 1,
      predictedWinner: 'HOME',
    });

    const upToDate = await requestJson(`/leagues/${league._id}/picks/remind-missing`, {
      token: master.token,
      body: {},
    });
    expect(upToDate.status).toBe(400);
    expect(upToDate.body).toEqual({ error: 'All league members have picks for upcoming matches' });
  });

  it('emails only missing-pick members without recent PWA use or push subscriptions', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const emailOnly = await registerPlayer('email-only@worldporra.test', 'Email Only');
    const pwaUser = await registerPlayer('pwa@worldporra.test', 'PWA User');
    const pushUser = await registerPlayer('push@worldporra.test', 'Push User');
    const league = await createLeague(master.token);
    await requestJson('/leagues/join', { token: emailOnly.token, body: { inviteCode: league.inviteCode } });
    await requestJson('/leagues/join', { token: pwaUser.token, body: { inviteCode: league.inviteCode } });
    await requestJson('/leagues/join', { token: pushUser.token, body: { inviteCode: league.inviteCode } });

    const match = await Match.create({
      externalId: 662,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    });
    await Prediction.create({
      userId: master.user.id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      predictedWinner: 'HOME',
    });
    await UserDevice.create({
      userId: pwaUser.user.id,
      deviceId: 'pwa-device-1',
      displayMode: 'standalone',
      platform: 'web',
      userAgent: '',
      browserLanguage: 'en',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });
    await PushSubscription.create({
      userId: pushUser.user.id,
      endpoint: 'https://push.example.test/subscription/push-user',
      keys: { p256dh: 'key', auth: 'auth' },
    });

    emailMocks.sendMissingPickReminderEmails.mockResolvedValueOnce({
      attempted: 1,
      sent: 1,
      skippedAlreadySent: 0,
      skippedQuota: 0,
      skippedNotConfigured: 0,
      failed: 0,
    });

    const preview = await requestJson<{ matches: number; recipients: number; emailFallbackRecipients: number }>(
      `/leagues/${league._id}/picks/remind-missing/preview`,
      { token: master.token }
    );
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ matches: 1, recipients: 3, emailFallbackRecipients: 1 });

    const reminded = await requestJson<{ ok: true; recipients: number; emailRecipients: number }>(
      `/leagues/${league._id}/picks/remind-missing`,
      { token: master.token, body: {} }
    );

    expect(reminded.status).toBe(200);
    expect(reminded.body).toMatchObject({ ok: true, recipients: 3, emailRecipients: 1 });
    expect(pushMocks.sendToUsers).toHaveBeenCalledWith(
      expect.arrayContaining([emailOnly.user.id, pwaUser.user.id, pushUser.user.id]),
      expect.objectContaining({ title: 'Friends League: picks reminder' })
    );
    expect(emailMocks.sendMissingPickReminderEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [{ userId: emailOnly.user.id, email: 'email-only@worldporra.test', name: 'Email Only' }],
      })
    );
  });

  it('locks payment rules after the tournament starts', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const league = await createLeague(master.token);
    await Match.create({
      externalId: 650,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'ARG',
      awayTeamCode: 'ESP',
      utcDate: new Date(Date.now() - 60 * 60 * 1000),
      status: 'FINISHED',
      result: { homeGoals: 1, awayGoals: 0, winner: 'HOME' },
    });

    const locked = await requestJson(`/leagues/${league._id}/payments`, {
      method: 'PATCH',
      token: master.token,
      body: {
        entryFee: 25,
        payoutSplits: [
          { position: 1, amount: 25 },
          { position: 2, amount: 0 },
          { position: 3, amount: 0 },
        ],
      },
    });
    expect(locked.status).toBe(400);
    expect(locked.body).toEqual({ error: 'Payment rules are locked after the tournament starts' });
  });

  it('lets non-owner members leave but keeps the owner in the league', async () => {
    const owner = await registerPlayer('owner@worldporra.test', 'Owner');
    const member = await registerPlayer('member@worldporra.test', 'Member');
    const league = await createLeague(owner.token);
    await requestJson('/leagues/join', { token: member.token, body: { inviteCode: league.inviteCode } });

    const ownerLeave = await requestJson(`/leagues/${league._id}/leave`, {
      method: 'DELETE',
      token: owner.token,
    });
    expect(ownerLeave.status).toBe(400);

    const leave = await requestJson(`/leagues/${league._id}/leave`, {
      method: 'DELETE',
      token: member.token,
    });
    expect(leave.status).toBe(200);
    expect(leave.body).toEqual({ message: 'Left league successfully' });

    const stored = await League.findById(league._id).lean();
    expect(stored?.members.map((memberEntry) => String(memberEntry.userId))).toEqual([owner.user.id]);
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
  it('returns started predictions to members and pending pick status only to admins', async () => {
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
    const live = await Match.create({
      externalId: 703,
      stage: 'GROUP',
      group: 'A',
      matchday: 1,
      homeTeamCode: 'URU',
      awayTeamCode: 'POR',
      utcDate: new Date(Date.now() - 60 * 60 * 1000),
      status: 'LIVE',
      result: { homeGoals: 0, awayGoals: 0, winner: 'DRAW' },
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
      { userId: member.user.id, matchId: live._id, homeGoals: 1, awayGoals: 1, predictedWinner: 'DRAW' },
      { userId: member.user.id, matchId: upcoming._id, homeGoals: 1, awayGoals: 1, predictedWinner: 'DRAW' },
    ]);
    await GroupPrediction.create({
      userId: member.user.id,
      group: 'A',
      orderedTeamCodes: ['ARG', 'ESP', 'URU', 'POR'],
      points: 12,
    });
    await TournamentPrediction.create({
      userId: member.user.id,
      championCode: 'ARG',
      runnerUpCode: 'ESP',
      semi1Code: 'URU',
      semi2Code: 'POR',
      topScorer: { name: 'Test Striker', team: 'Argentina', code: 'ARG', pos: 'FW', age: 27, shirtNumber: 9 },
    });
    const lockPredictions = await requestJson('/config/poll', {
      method: 'PATCH',
      token: master.token,
      body: {
        groupPredictionsDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
        tournamentPredictionsDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    });
    expect(lockPredictions.status).toBe(200);

    const forbidden = await requestJson(`/leagues/${league._id}/members/${member.user.id}/predictions`, {
      token: outsider.token,
    });
    expect(forbidden.status).toBe(403);

    const memberResponse = await requestJson<{
      pointsBreakdown: { matches: number; groups: number; tournament: number; total: number };
      finishedMatches: Array<{ status: string; prediction: { points: number | null } }>;
      upcomingMatches: Array<{ hasPick: boolean }>;
      groupPredictions: Array<{ group: string; points: number | null; orderedTeams: Array<{ code: string; name: string }> }>;
      tournamentPrediction: { champion: { code: string; name: string }; topScorer: { name: string; code: string } } | null;
    }>(
      `/leagues/${league._id}/members/${member.user.id}/predictions`,
      { token: member.token }
    );
    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.pointsBreakdown).toEqual({ matches: 10, groups: 12, tournament: 0, total: 22 });
    expect(memberResponse.body.finishedMatches.map((match) => match.status).sort()).toEqual(['FINISHED', 'LIVE']);
    expect(memberResponse.body.finishedMatches.find((match) => match.status === 'FINISHED')?.prediction.points).toBe(10);
    expect(memberResponse.body.upcomingMatches).toHaveLength(0);
    expect(memberResponse.body.groupPredictions).toHaveLength(1);
    expect(memberResponse.body.groupPredictions[0].group).toBe('A');
    expect(memberResponse.body.groupPredictions[0].points).toBe(12);
    expect(memberResponse.body.groupPredictions[0].orderedTeams.map((team) => team.code)).toEqual(['ARG', 'ESP', 'URU', 'POR']);
    expect(memberResponse.body.groupPredictions[0].orderedTeams.slice(0, 2)).toMatchObject([
      { code: 'ARG', name: 'Argentina' },
      { code: 'ESP', name: 'Spain' },
    ]);
    expect(memberResponse.body.tournamentPrediction?.champion).toMatchObject({ code: 'ARG', name: 'Argentina' });
    expect(memberResponse.body.tournamentPrediction?.topScorer).toMatchObject({ name: 'Test Striker', code: 'ARG' });

    const response = await requestJson<{ finishedMatches: Array<{ status: string; prediction: { points: number } }>; upcomingMatches: Array<{ hasPick: boolean }> }>(
      `/leagues/${league._id}/members/${member.user.id}/predictions`,
      { token: master.token }
    );
    expect(response.status).toBe(200);
    expect(response.body.finishedMatches).toHaveLength(2);
    expect(response.body.finishedMatches.find((match) => match.status === 'FINISHED')?.prediction.points).toBe(10);
    expect(response.body.upcomingMatches).toHaveLength(1);
    expect(response.body.upcomingMatches[0].hasPick).toBe(true);
  });
});
