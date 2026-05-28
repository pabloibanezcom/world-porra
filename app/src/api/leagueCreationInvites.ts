import { apiClient } from './client';

export interface LeagueCreationInvitePreview {
  valid: boolean;
  expiresAt: string;
}

export async function generateLeagueCreationInvite(): Promise<{ token: string; expiresAt: string }> {
  const { data } = await apiClient.post<{ invite: { token: string; expiresAt: string } }>(
    '/league-creation-invites'
  );
  return data.invite;
}

export async function fetchLeagueCreationInvitePreview(token: string): Promise<LeagueCreationInvitePreview> {
  const { data } = await apiClient.get<LeagueCreationInvitePreview>(`/league-creation-invites/${token}`);
  return data;
}

export async function redeemLeagueCreationInvite(token: string): Promise<void> {
  await apiClient.post(`/league-creation-invites/${token}/redeem`);
}
