import { apiClient } from './client';
import { TournamentCatalogTeam } from '../types';

export interface PollConfig {
  groupPredictionsDeadline: string | null;
  tournamentPredictionsDeadline: string | null;
  leagueCreationDeadline: string | null;
  groupPredictionsLocked: boolean;
  tournamentPredictionsLocked: boolean;
  leagueCreationLocked: boolean;
  serverTime: string;
}

export interface ApiHealth {
  status: string;
  db: string;
  dbName: string;
  scenario: string | null;
  tournamentNow: string | null;
  deployment?: {
    environment: string;
    commitSha: string | null;
    commitRef: string | null;
    url: string | null;
  };
  timestamp: string;
}

export async function fetchPollConfig(): Promise<PollConfig> {
  const { data } = await apiClient.get<{ config: PollConfig }>('/config/poll');
  return data.config;
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  const { data } = await apiClient.get<ApiHealth>('/health');
  return data;
}

export async function fetchTournamentCatalog(): Promise<TournamentCatalogTeam[]> {
  const { data } = await apiClient.get<{ teams: TournamentCatalogTeam[] }>('/config/tournament-catalog');
  return data.teams;
}
