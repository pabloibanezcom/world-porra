import { apiClient } from './client';
import { Match, Prediction } from '../types';

export async function fetchMatches(params?: {
  stage?: string;
  group?: string;
  status?: string;
}): Promise<Match[]> {
  const { data } = await apiClient.get<{ matches: Match[] }>('/matches', { params });
  return data.matches;
}

export async function fetchMatch(id: string): Promise<{ match: Match; prediction: Prediction | null }> {
  const { data } = await apiClient.get(`/matches/${id}`);
  return data;
}
