export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  totalPoints: number;
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
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  winner: MatchWinner;
}

export interface Match {
  _id: string;
  externalId: number;
  stage: MatchStage;
  group: string | null;
  matchday: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  utcDate: string;
  status: MatchStatus;
  result: MatchResult | null;
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

export interface LeagueMember {
  userId: User;
  joinedAt: string;
}

export interface League {
  _id: string;
  name: string;
  inviteCode: string;
  ownerId: User;
  members: LeagueMember[];
  maxMembers: number;
}
