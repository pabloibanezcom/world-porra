import type { MatchStage, MatchStatus } from './matches';
import type { TeamInfo } from './teams';
import type { User } from './users';

export interface AdminUserLeague {
  _id: string;
  name: string;
  inviteCode: string;
  joinedAt: string;
  isAdmin: boolean;
  hasPaid: boolean;
}

export interface AdminUserSummary extends User {
  createdAt: string;
  updatedAt: string;
  leagueCount: number;
  predictionCount: number;
  groupPredictionCount: number;
  hasTournamentPrediction: boolean;
  leagues: AdminUserLeague[];
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  total: number;
}

export interface AdminUserMatchPredictionStatus {
  _id: string;
  matchId: string;
  hasPrediction: boolean;
  isRevealed: boolean;
  homeGoals?: number;
  awayGoals?: number;
  qualifier?: 'HOME' | 'AWAY' | null;
  points?: number | null;
  createdAt: string;
  updatedAt: string;
  match: {
    _id: string;
    stage: MatchStage;
    status: MatchStatus;
    group: string | null;
    utcDate: string;
    homeTeam: TeamInfo;
    awayTeam: TeamInfo;
  } | null;
}

export interface AdminUserGroupPrediction {
  _id: string;
  group: string;
  hasPrediction: boolean;
  isRevealed: boolean;
  orderedTeamCodes?: string[];
  points?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserTournamentPrediction {
  hasPrediction: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  predictions: {
    total: number;
    scored: number;
    pending: number;
    recent: AdminUserMatchPredictionStatus[];
  };
  groupPredictions: AdminUserGroupPrediction[];
  tournamentPrediction: AdminUserTournamentPrediction | null;
}
