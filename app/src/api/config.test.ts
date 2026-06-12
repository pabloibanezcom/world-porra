import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { clearConfigApiCache, fetchPollConfig, fetchTournamentCatalog } from './config';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = apiClient.get as Mock;

describe('config API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigApiCache();
  });

  it('fetches poll configuration', async () => {
    const config = {
      groupPredictionsDeadline: null,
      tournamentPredictionsDeadline: null,
      leagueCreationDeadline: null,
      groupPredictionsLocked: false,
      tournamentPredictionsLocked: false,
      leagueCreationLocked: false,
      serverTime: '2026-06-09T12:00:00.000Z',
    };
    mockedGet.mockResolvedValueOnce({ data: { config } });

    await expect(fetchPollConfig()).resolves.toEqual(config);
    expect(mockedGet).toHaveBeenCalledWith('/config/poll');
  });

  it('fetches tournament catalog teams with embedded players', async () => {
    const teams = [
      {
        code: 'ESP',
        name: 'Spain',
        crest: '',
        color: '',
        players: [{ name: 'Lamine Yamal', pos: 'FW', age: 18 }],
      },
    ];
    mockedGet.mockResolvedValueOnce({ data: { teams } });

    await expect(fetchTournamentCatalog()).resolves.toEqual(teams);
    expect(mockedGet).toHaveBeenCalledWith('/config/tournament-catalog');
  });
});
