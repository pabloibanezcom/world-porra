import { apiClient } from './client';
import { League, Match, MatchResult } from '../types';

export interface MemberMatchPrediction {
  _id: string;
  homeTeam: Match['homeTeam'];
  awayTeam: Match['awayTeam'];
  utcDate: string;
  stage: Match['stage'];
  group: string | null;
  result: MatchResult | null;
  prediction: { homeGoals: number; awayGoals: number; points: number | null } | null;
}

export interface MemberUpcomingMatch {
  _id: string;
  homeTeam: Match['homeTeam'];
  awayTeam: Match['awayTeam'];
  utcDate: string;
  stage: Match['stage'];
  group: string | null;
  hasPick: boolean;
}

export interface MemberPredictionsResponse {
  finishedMatches: MemberMatchPrediction[];
  upcomingMatches: MemberUpcomingMatch[];
}

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

export async function fetchMemberPredictions(
  leagueId: string,
  userId: string
): Promise<MemberPredictionsResponse> {
  const { data } = await apiClient.get<MemberPredictionsResponse>(
    `/leagues/${leagueId}/members/${userId}/predictions`
  );
  return data;
}
