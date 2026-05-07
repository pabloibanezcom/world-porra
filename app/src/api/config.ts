import { apiClient } from './client';
import { TournamentCatalogTeam } from '../data/tournamentData';

export interface PollConfig {
  groupPredictionsDeadline: string | null;
  tournamentPredictionsDeadline: string | null;
  groupPredictionsLocked: boolean;
  tournamentPredictionsLocked: boolean;
}

export async function fetchPollConfig(): Promise<PollConfig> {
  const { data } = await apiClient.get<{ config: PollConfig }>('/config/poll');
  return data.config;
}

export async function fetchTournamentCatalog(): Promise<TournamentCatalogTeam[]> {
  const { data } = await apiClient.get<{ teams: TournamentCatalogTeam[] }>('/config/tournament-catalog');
  return data.teams;
}
