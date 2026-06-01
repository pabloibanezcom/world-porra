import { apiClient } from './client';
import { GroupPrediction, Prediction, TeamInfo, TournamentPicks } from '../types';
import { markPredictionsChanged } from '../store/dataRefreshStore';

function normalizePrediction(prediction: Prediction & { matchId: unknown }): Prediction {
  let normalizedMatchId = '';

  if (typeof prediction.matchId === 'string') {
    normalizedMatchId = prediction.matchId;
  } else if (prediction.matchId && typeof prediction.matchId === 'object') {
    const populatedMatch = prediction.matchId as { _id?: string };
    normalizedMatchId = populatedMatch._id || '';
  }

  return { ...prediction, matchId: normalizedMatchId };
}

export async function submitPrediction(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  qualifier?: 'HOME' | 'AWAY' | null,
): Promise<Prediction> {
  const { data } = await apiClient.post<{ prediction: Prediction }>('/predictions', {
    matchId,
    homeGoals,
    awayGoals,
    ...(qualifier !== undefined ? { qualifier } : {}),
  });
  const prediction = normalizePrediction(data.prediction as Prediction & { matchId: unknown });
  markPredictionsChanged();
  return prediction;
}

export async function fetchMyPredictions(stage?: string): Promise<Prediction[]> {
  const { data } = await apiClient.get<{ predictions: Prediction[] }>('/predictions/mine', {
    params: stage ? { stage } : undefined,
  });
  return data.predictions.map((prediction) =>
    normalizePrediction(prediction as Prediction & { matchId: unknown })
  );
}

export async function fetchMyGroupPredictions(): Promise<GroupPrediction[]> {
  const { data } = await apiClient.get<{ predictions: GroupPrediction[] }>('/predictions/groups/mine');
  return data.predictions;
}

export async function submitGroupPrediction(group: string, orderedTeams: TeamInfo[]): Promise<GroupPrediction> {
  const { data } = await apiClient.post<{ prediction: GroupPrediction }>('/predictions/groups', {
    group,
    orderedTeamCodes: orderedTeams.map((team) => team.code),
  });
  markPredictionsChanged();
  return data.prediction;
}

export async function fetchTournamentPrediction(): Promise<TournamentPicks> {
  const { data } = await apiClient.get<{ prediction: TournamentPicks | null }>('/predictions/tournament');
  return data.prediction ?? {};
}

export async function saveTournamentPrediction(picks: TournamentPicks): Promise<void> {
  await apiClient.post('/predictions/tournament', picks);
  markPredictionsChanged();
}
