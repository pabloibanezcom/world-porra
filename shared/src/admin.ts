import type { MatchResult, MatchStage } from './matches';
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

export interface AdminUserMatchPrediction {
  _id: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  qualifier: 'HOME' | 'AWAY' | null;
  points: number | null;
  createdAt: string;
  updatedAt: string;
  match: {
    _id: string;
    stage: MatchStage;
    group: string | null;
    utcDate: string;
    homeTeam: TeamInfo;
    awayTeam: TeamInfo;
    result: MatchResult | null;
  } | null;
}

export interface AdminUserGroupPrediction {
  _id: string;
  group: string;
  orderedTeamCodes: string[];
  points: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserTournamentPrediction {
  championCode?: string;
  runnerUpCode?: string;
  semi1Code?: string;
  semi2Code?: string;
  bestPlayer?: { name: string; team: string; code: string; pos: string; age: number };
  topScorer?: { name: string; team: string; code: string; pos: string; age: number };
  bestYoung?: { name: string; team: string; code: string; pos: string; age: number };
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  predictions: {
    total: number;
    scored: number;
    pending: number;
    recent: AdminUserMatchPrediction[];
  };
  groupPredictions: AdminUserGroupPrediction[];
  tournamentPrediction: AdminUserTournamentPrediction | null;
}
