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

const POLL_CONFIG_CACHE_MS = 60 * 1000;
let pollConfigCache: { value: PollConfig; expiresAt: number } | null = null;
let pollConfigRequest: Promise<PollConfig> | null = null;

export function clearConfigApiCache() {
  pollConfigCache = null;
  pollConfigRequest = null;
}

export async function fetchPollConfig(options: { force?: boolean } = {}): Promise<PollConfig> {
  const now = Date.now();
  if (!options.force && pollConfigCache && pollConfigCache.expiresAt > now) {
    return pollConfigCache.value;
  }

  if (!options.force && pollConfigRequest) {
    return pollConfigRequest;
  }

  pollConfigRequest = apiClient.get<{ config: PollConfig }>('/config/poll')
    .then(({ data }) => {
      pollConfigCache = {
        value: data.config,
        expiresAt: Date.now() + POLL_CONFIG_CACHE_MS,
      };
      return data.config;
    })
    .finally(() => {
      pollConfigRequest = null;
    });

  return pollConfigRequest;
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  const { data } = await apiClient.get<ApiHealth>('/health');
  return data;
}

export async function fetchTournamentCatalog(): Promise<TournamentCatalogTeam[]> {
  const { data } = await apiClient.get<{ teams: TournamentCatalogTeam[] }>('/config/tournament-catalog');
  return data.teams;
}
