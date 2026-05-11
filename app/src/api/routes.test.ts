import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { getMe, loginDev, loginWithGoogle, loginWithPassword, updateMe } from './auth';
import { createLeague, deleteLeague, fetchLeague, fetchMemberPredictions, fetchMyLeagues, joinLeague, leaveLeague, notifyLeagueMembers } from './leagues';
import { fetchMatch, fetchMatches } from './matches';
import { fetchPollConfig } from './config';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = {
  get: apiClient.get as Mock,
  post: apiClient.post as Mock,
  patch: apiClient.patch as Mock,
  delete: apiClient.delete as Mock,
};

describe('API route helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls auth endpoints and returns their payloads', async () => {
    const authResponse = { token: 'token-1', user: { id: 'user-1', name: 'Player' } };
    mockedApiClient.post.mockResolvedValueOnce({ data: authResponse });
    await expect(loginWithPassword('player@example.test', 'password')).resolves.toBe(authResponse);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'player@example.test',
      password: 'password',
    });

    mockedApiClient.post.mockResolvedValueOnce({ data: authResponse });
    await expect(loginWithGoogle('google-token')).resolves.toBe(authResponse);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/google', { idToken: 'google-token' });

    mockedApiClient.post.mockResolvedValueOnce({ data: authResponse });
    await expect(loginDev()).resolves.toBe(authResponse);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/dev', undefined);

    mockedApiClient.post.mockResolvedValueOnce({ data: authResponse });
    await expect(loginDev('player@example.test')).resolves.toBe(authResponse);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/dev', { email: 'player@example.test' });

    mockedApiClient.get.mockResolvedValueOnce({ data: { user: authResponse.user } });
    await expect(getMe()).resolves.toBe(authResponse.user);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/auth/me');

    mockedApiClient.patch.mockResolvedValueOnce({ data: { user: { ...authResponse.user, name: 'Pablo' } } });
    await expect(updateMe('Pablo')).resolves.toMatchObject({ name: 'Pablo' });
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/auth/me', { name: 'Pablo' });
  });

  it('calls match endpoints with the expected route and params', async () => {
    const matches = [{ _id: 'match-1' }];
    mockedApiClient.get.mockResolvedValueOnce({ data: { matches } });
    await expect(fetchMatches({ stage: 'GROUP', group: 'A' })).resolves.toBe(matches);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/matches', {
      params: { stage: 'GROUP', group: 'A' },
    });

    const matchPayload = { match: { _id: 'match-1' }, prediction: null };
    mockedApiClient.get.mockResolvedValueOnce({ data: matchPayload });
    await expect(fetchMatch('match-1')).resolves.toBe(matchPayload);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/match-1');
  });

  it('fetches poll configuration', async () => {
    const config = {
      groupPredictionsDeadline: '2026-06-11T00:00:00.000Z',
      tournamentPredictionsDeadline: '2026-06-11T00:00:00.000Z',
      leagueCreationDeadline: '2026-06-10T00:00:00.000Z',
      groupPredictionsLocked: false,
      tournamentPredictionsLocked: false,
      leagueCreationLocked: false,
      serverTime: '2026-06-09T12:00:00.000Z',
    };
    mockedApiClient.get.mockResolvedValueOnce({ data: { config } });

    await expect(fetchPollConfig()).resolves.toBe(config);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/config/poll');
  });

  it('calls league endpoints and unwraps response data', async () => {
    const league = { _id: 'league-1', name: 'Friends' };
    mockedApiClient.post.mockResolvedValueOnce({ data: { league } });
    await expect(createLeague('Friends')).resolves.toBe(league);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/leagues', { name: 'Friends' });

    mockedApiClient.post.mockResolvedValueOnce({ data: { league } });
    await expect(joinLeague('ABC123')).resolves.toBe(league);
    expect(mockedApiClient.post).toHaveBeenCalledWith('/leagues/join', { inviteCode: 'ABC123' });

    mockedApiClient.get.mockResolvedValueOnce({ data: { leagues: [league] } });
    await expect(fetchMyLeagues()).resolves.toEqual([league]);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/leagues');

    mockedApiClient.get.mockResolvedValueOnce({ data: { league } });
    await expect(fetchLeague('league-1')).resolves.toBe(league);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/leagues/league-1');
  });

  it('calls league action endpoints', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({ data: {} });
    await expect(leaveLeague('league-1')).resolves.toBeUndefined();
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/leagues/league-1/leave');

    mockedApiClient.delete.mockResolvedValueOnce({ data: {} });
    await expect(deleteLeague('league-1')).resolves.toBeUndefined();
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/leagues/league-1');

    mockedApiClient.post.mockResolvedValueOnce({ data: {} });
    await expect(notifyLeagueMembers('league-1', 'Title', 'Body')).resolves.toBeUndefined();
    expect(mockedApiClient.post).toHaveBeenCalledWith('/leagues/league-1/notify', {
      title: 'Title',
      body: 'Body',
    });

    const memberPredictions = { finishedMatches: [], upcomingMatches: [] };
    mockedApiClient.get.mockResolvedValueOnce({ data: memberPredictions });
    await expect(fetchMemberPredictions('league-1', 'user-1')).resolves.toBe(memberPredictions);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/leagues/league-1/members/user-1/predictions');
  });
});
