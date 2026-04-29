export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  avatarUrl: string;
  totalPoints: number;
  isMaster?: boolean;
}

export type MatchStage =
  | 'GROUP'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
export type MatchWinner = 'HOME' | 'AWAY' | 'DRAW';

export interface TeamInfo {
  name: string;
  code: string;
  crest: string;
  color: string;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  winner: MatchWinner;
}

export interface MatchOdds {
  home: number | null;
  draw: number | null;
  away: number | null;
}

export interface Match {
  _id: string;
  externalId: number;
  stage: MatchStage;
  group: string | null;
  matchday: number;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  utcDate: string;
  status: MatchStatus;
  result: MatchResult | null;
  odds?: MatchOdds | null;
}

export interface Prediction {
  _id: string;
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  predictedWinner: MatchWinner;
  points: number | null;
}

export interface GroupPrediction {
  _id: string;
  userId: string;
  group: string;
  orderedTeamCodes: string[];
  orderedTeams: TeamInfo[];
  points: number | null;
}

export interface LeagueMember {
  userId: User;
  joinedAt: string;
  isAdmin?: boolean;
  totalPoints?: number;
}

export interface League {
  _id: string;
  name: string;
  inviteCode: string;
  ownerId: User;
  members: LeagueMember[];
  maxMembers: number;
}
