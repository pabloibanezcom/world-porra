import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  fetchMyPredictions,
  fetchTournamentPrediction,
  saveTournamentPrediction,
  submitGroupPrediction,
  submitPrediction,
} from './predictions';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApiClient = {
  get: apiClient.get as Mock,
  post: apiClient.post as Mock,
};

describe('prediction API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits match predictions and normalizes string match ids', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: {
        prediction: {
          _id: 'prediction-1',
          matchId: 'match-1',
          homeGoals: 2,
          awayGoals: 1,
          predictedWinner: 'HOME',
          points: null,
        },
      },
    });

    const prediction = await submitPrediction('match-1', 2, 1);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/predictions', {
      matchId: 'match-1',
      homeGoals: 2,
      awayGoals: 1,
    });
    expect(prediction.matchId).toBe('match-1');
  });

  it('normalizes populated match ids when fetching predictions', async () => {
    mockedApiClient.get.mockResolvedValueOnce({
      data: {
        predictions: [
          {
            _id: 'prediction-1',
            matchId: { _id: 'match-1' },
            homeGoals: 1,
            awayGoals: 1,
            predictedWinner: 'DRAW',
            points: 5,
          },
        ],
      },
    });

    const predictions = await fetchMyPredictions('GROUP');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/predictions/mine', {
      params: { stage: 'GROUP' },
    });
    expect(predictions[0].matchId).toBe('match-1');
  });

  it('omits stage params when fetching all predictions', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { predictions: [] } });

    await expect(fetchMyPredictions()).resolves.toEqual([]);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/predictions/mine', {
      params: undefined,
    });
  });

  it('submits group prediction team codes', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: { prediction: { group: 'A', orderedTeamCodes: ['ARG', 'ESP'], orderedTeams: [] } },
    });

    const prediction = await submitGroupPrediction('A', [
      { code: 'ARG', name: 'Argentina', crest: '' },
      { code: 'ESP', name: 'Spain', crest: '' },
    ]);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/predictions/groups', {
      group: 'A',
      orderedTeamCodes: ['ARG', 'ESP'],
    });
    expect(prediction.orderedTeamCodes).toEqual(['ARG', 'ESP']);
  });

  it('returns empty tournament picks when the API has no saved prediction', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { prediction: null } });

    await expect(fetchTournamentPrediction()).resolves.toEqual({});
  });

  it('posts tournament picks without returning data', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ data: {} });
    const picks = { champion: { code: 'ARG', name: 'Argentina', crest: '' } };

    await expect(saveTournamentPrediction(picks)).resolves.toBeUndefined();
    expect(mockedApiClient.post).toHaveBeenCalledWith('/predictions/tournament', picks);
  });
});
