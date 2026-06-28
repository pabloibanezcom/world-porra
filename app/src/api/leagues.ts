import { apiClient } from './client';
import { GroupPrediction, League, LeaguePaymentSettings, LeagueScoringScope, Match, MatchResult, TournamentPicks } from '../types';
import { markLeaguesChanged } from '../store/dataRefreshStore';

export interface MemberMatchPrediction {
  _id: string;
  homeTeam: Match['homeTeam'];
  awayTeam: Match['awayTeam'];
  utcDate: string;
  stage: Match['stage'];
  status: Match['status'];
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
  pointsBreakdown: {
    matches: number;
    groups: number;
    tournament: number;
    total: number;
  };
  finishedMatches: MemberMatchPrediction[];
  upcomingMatches: MemberUpcomingMatch[];
  groupPredictions: GroupPrediction[];
  tournamentPrediction: TournamentPicks | null;
}

export interface MissingPickReminderPreview {
  matches: number;
  recipients: number;
  emailFallbackRecipients: number;
  members: Array<{ id: string; name: string; avatarUrl: string }>;
}

export async function createLeague(
  name: string,
  paymentSettings?: LeaguePaymentSettings,
  scoringScope?: LeagueScoringScope
): Promise<League> {
  const payload: { name: string; paymentSettings?: LeaguePaymentSettings; scoringScope?: LeagueScoringScope } = { name };
  if (paymentSettings) payload.paymentSettings = paymentSettings;
  if (scoringScope) payload.scoringScope = scoringScope;

  const { data } = await apiClient.post<{ league: League }>('/leagues', payload);
  markLeaguesChanged();
  return data.league;
}

export async function joinLeague(inviteCode: string): Promise<League> {
  const { data } = await apiClient.post<{ league: League }>('/leagues/join', { inviteCode });
  markLeaguesChanged();
  return data.league;
}

export async function fetchLeagueInvitePreview(inviteCode: string): Promise<{ name: string; inviteCode: string }> {
  const { data } = await apiClient.get<{ league: { name: string; inviteCode: string } }>(
    `/leagues/invite/${encodeURIComponent(inviteCode)}`
  );
  return data.league;
}

export async function fetchMyLeagues(): Promise<League[]> {
  const { data } = await apiClient.get<{ leagues: League[] }>('/leagues');
  return data.leagues;
}

export async function updateLeagueOrder(leagueIds: string[]): Promise<League[]> {
  const { data } = await apiClient.patch<{ leagues: League[] }>('/leagues/order', { leagueIds });
  markLeaguesChanged();
  return data.leagues;
}

export async function fetchLeague(id: string): Promise<League> {
  const { data } = await apiClient.get<{ league: League }>(`/leagues/${id}`);
  return data.league;
}

export async function leaveLeague(id: string): Promise<void> {
  await apiClient.delete(`/leagues/${id}/leave`);
  markLeaguesChanged();
}

export async function deleteLeague(id: string): Promise<void> {
  await apiClient.delete(`/leagues/${id}`);
  markLeaguesChanged();
}

export async function notifyLeagueMembers(id: string, title: string, body: string): Promise<void> {
  await apiClient.post(`/leagues/${id}/notify`, { title, body });
}

export async function remindUnpaidLeagueMembers(id: string): Promise<{ recipients: number }> {
  const { data } = await apiClient.post<{ ok: true; recipients: number }>(`/leagues/${id}/payments/remind-unpaid`);
  return { recipients: data.recipients };
}

export async function remindMissingPickMembers(id: string): Promise<{
  recipients: number;
  matches: number;
  pushRecipients: number;
  emailRecipients: number;
  emailSkipped: number;
}> {
  const { data } = await apiClient.post<{
    ok: true;
    recipients: number;
    matches: number;
    pushRecipients: number;
    emailRecipients: number;
    emailSkipped: number;
  }>(`/leagues/${id}/picks/remind-missing`);
  return {
    recipients: data.recipients,
    matches: data.matches,
    pushRecipients: data.pushRecipients,
    emailRecipients: data.emailRecipients,
    emailSkipped: data.emailSkipped,
  };
}

export async function fetchMissingPickReminderPreview(id: string): Promise<MissingPickReminderPreview> {
  const { data } = await apiClient.get<MissingPickReminderPreview>(`/leagues/${id}/picks/remind-missing/preview`);
  return data;
}

export async function addLeagueAdmin(id: string, userId: string): Promise<void> {
  await apiClient.post(`/leagues/${id}/admins`, { userId });
  markLeaguesChanged();
}

export async function removeLeagueAdmin(id: string, userId: string): Promise<void> {
  await apiClient.delete(`/leagues/${id}/admins/${userId}`);
  markLeaguesChanged();
}

export async function updateLeaguePaymentSettings(
  id: string,
  paymentSettings: LeaguePaymentSettings
): Promise<League> {
  const { data } = await apiClient.patch<{ league: League }>(`/leagues/${id}/payments`, paymentSettings);
  markLeaguesChanged();
  return data.league;
}

export async function updateLeagueMemberPayment(
  leagueId: string,
  userId: string,
  hasPaid: boolean
): Promise<League> {
  const { data } = await apiClient.patch<{ league: League }>(
    `/leagues/${leagueId}/members/${userId}/payment`,
    { hasPaid }
  );
  markLeaguesChanged();
  return data.league;
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
