import type { User } from './users';

export interface LeagueMember {
  userId: User;
  joinedAt: string;
  isAdmin?: boolean;
  hasPaid?: boolean;
  paidAt?: string | null;
  totalPoints?: number;
}

export interface LeaguePayoutSplit {
  position: number;
  amount: number;
}

export interface LeaguePaymentSettings {
  entryFee: number;
  payoutSplits: LeaguePayoutSplit[];
}

export interface League {
  _id: string;
  name: string;
  inviteCode: string;
  ownerId: User;
  members: LeagueMember[];
  maxMembers: number;
  paymentSettings?: LeaguePaymentSettings;
}
