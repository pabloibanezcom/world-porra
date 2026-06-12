import { z } from 'zod';
import type { MatchWinner } from './matches';
import { teamOptionSchema, playerOptionSchema } from './teams';
import type { PlayerOption, TeamInfo, TeamOption } from './teams';

export const qualifierSchema = z.enum(['HOME', 'AWAY']);
export type Qualifier = z.infer<typeof qualifierSchema>;

export const tournamentPicksSchema = z.object({
  champion: teamOptionSchema.optional(),
  runnerUp: teamOptionSchema.optional(),
  semi1: teamOptionSchema.optional(),
  semi2: teamOptionSchema.optional(),
  bestPlayer: playerOptionSchema.optional(),
  topScorer: playerOptionSchema.optional(),
  bestYoung: playerOptionSchema.optional(),
});

export interface TournamentPicks {
  champion?: TeamOption;
  runnerUp?: TeamOption;
  semi1?: TeamOption;
  semi2?: TeamOption;
  bestPlayer?: PlayerOption;
  topScorer?: PlayerOption;
  bestYoung?: PlayerOption;
}

export const TOURNAMENT_SLOT_KEYS: (keyof TournamentPicks)[] = [
  'champion',
  'runnerUp',
  'semi1',
  'semi2',
  'bestPlayer',
  'topScorer',
  'bestYoung',
];

export const matchPredictionInputSchema = z.object({
  matchId: z.string().min(1),
  homeGoals: z.number().int().min(0).max(15),
  awayGoals: z.number().int().min(0).max(15),
  qualifier: qualifierSchema.nullable().optional(),
});

export const groupPredictionInputSchema = z.object({
  group: z.string().min(1).max(8),
  orderedTeamCodes: z.array(z.string().min(1)).min(2).max(6).optional(),
  orderedTeams: z.array(z.object({
    code: z.string().min(1),
  })).min(2).max(6).optional(),
});

export const jokerInputSchema = z.object({
  matchId: z.string().min(1),
  active: z.boolean(),
});

export type MatchPredictionInput = z.infer<typeof matchPredictionInputSchema>;
export type GroupPredictionInput = z.infer<typeof groupPredictionInputSchema>;
export type TournamentPredictionInput = z.infer<typeof tournamentPicksSchema>;
export type JokerInput = z.infer<typeof jokerInputSchema>;

export interface Prediction {
  _id: string;
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  predictedWinner: MatchWinner;
  qualifier: Qualifier | null;
  joker: boolean;
  points: number | null;
}

export interface GroupPrediction {
  _id: string;
  userId: string;
  group: string;
  orderedTeamCodes: string[];
  orderedTeams: TeamInfo[];
  points: number | null;
  progress?: {
    projectedPoints: number;
    perfectBonus: number;
    currentOrderCodes: string[];
    currentOrder: Array<TeamInfo & {
      position: number;
      played: number;
      points: number;
      goalDifference: number;
    }>;
    teams: Array<{
      code: string;
      predictedPosition: number;
      currentPosition: number | null;
      points: number;
      status: 'exact' | 'qualified' | 'miss' | 'pending';
    }>;
  } | null;
}
