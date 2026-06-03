import { z } from 'zod';

export const playerPositionSchema = z.enum(['FW', 'MF', 'DF', 'GK']);
export type PlayerPosition = z.infer<typeof playerPositionSchema>;

export const teamInfoSchema = z.object({
  name: z.string(),
  code: z.string(),
  crest: z.string(),
  color: z.string().optional(),
});

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
  color: z.string().optional(),
  pos: playerPositionSchema,
  age: z.number().int().min(0).max(60),
  shirtNumber: z.number().int().min(1).max(99).optional(),
});

export const tournamentCatalogTeamSchema = teamOptionSchema.extend({
  name: z.string(),
  players: z.array(z.object({
    name: z.string(),
    pos: playerPositionSchema,
    age: z.number(),
    shirtNumber: z.number().int().min(1).max(99).optional(),
  })),
});

export interface TeamInfo {
  name: string;
  code: string;
  crest: string;
  color: string;
}

export interface TeamOption {
  name: string;
  code: string;
  crest?: string;
  color?: string;
}

export type PlayerOption = z.infer<typeof playerOptionSchema>;

export interface TournamentCatalogTeam extends TeamOption {
  players: Array<{
    name: string;
    pos: PlayerPosition;
    age: number;
    shirtNumber?: number;
  }>;
}
