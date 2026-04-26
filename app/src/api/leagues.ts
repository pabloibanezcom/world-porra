import { apiClient } from './client';
import { League } from '../types';

export async function createLeague(name: string): Promise<League> {
  const { data } = await apiClient.post<{ league: League }>('/leagues', { name });
  return data.league;
}

export async function joinLeague(inviteCode: string): Promise<League> {
  const { data } = await apiClient.post<{ league: League }>('/leagues/join', { inviteCode });
  return data.league;
}

export async function fetchMyLeagues(): Promise<League[]> {
  const { data } = await apiClient.get<{ leagues: League[] }>('/leagues');
  return data.leagues;
}

export async function fetchLeague(id: string): Promise<League> {
  const { data } = await apiClient.get<{ league: League }>(`/leagues/${id}`);
  return data.league;
}

export async function leaveLeague(id: string): Promise<void> {
  await apiClient.delete(`/leagues/${id}/leave`);
}

export async function notifyLeagueMembers(id: string, title: string, body: string): Promise<void> {
  await apiClient.post(`/leagues/${id}/notify`, { title, body });
}
