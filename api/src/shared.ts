import { z } from 'zod';

export const matchStageSchema = z.enum([
  'GROUP',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
]);

export const matchStatusSchema = z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED']);
export const matchWinnerSchema = z.enum(['HOME', 'AWAY', 'DRAW']);

export type MatchStage = z.infer<typeof matchStageSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
export type MatchWinner = z.infer<typeof matchWinnerSchema>;

export const MATCH_STAGES = matchStageSchema.options;
export const MATCH_STATUSES = matchStatusSchema.options;
export const MATCH_WINNERS = matchWinnerSchema.options;

export const playerPositionSchema = z.enum(['FW', 'MF', 'DF', 'GK']);
export type PlayerPosition = z.infer<typeof playerPositionSchema>;

export const teamOptionSchema = z.object({
  name: z.string().optional(),
  code: z.string().min(1),
  crest: z.string().optional(),
  color: z.string().optional(),
});

export const playerOptionSchema = z.object({
  name: z.string().min(1),
  team: z.string().min(1),
  code: z.string().min(1),
  pos: playerPositionSchema,
  age: z.number().int().min(0).max(60),
  shirtNumber: z.number().int().min(1).max(99).optional(),
});

export type TeamOption = z.infer<typeof teamOptionSchema>;
export type PlayerOption = z.infer<typeof playerOptionSchema>;

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
