import { apiClient } from './client';
import { Prediction } from '../types';

export async function submitPrediction(matchId: string, homeGoals: number, awayGoals: number): Promise<Prediction> {
  const { data } = await apiClient.post<{ prediction: Prediction }>('/predictions', {
    matchId,
    homeGoals,
    awayGoals,
  });
  return data.prediction;
}

export async function fetchMyPredictions(stage?: string): Promise<Prediction[]> {
  const { data } = await apiClient.get<{ predictions: Prediction[] }>('/predictions/mine', {
    params: stage ? { stage } : undefined,
  });
  return data.predictions;
}
