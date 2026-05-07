export interface TeamOption {
  name: string;
  code: string;
  crest?: string;
  color?: string;
}

export interface PlayerOption {
  name: string;
  team: string;
  code: string;
  pos: 'FW' | 'MF' | 'DF' | 'GK';
  age: number;
}

export interface TournamentCatalogTeam extends TeamOption {
  players: Array<{
    name: string;
    pos: PlayerOption['pos'];
    age: number;
  }>;
}

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
  'champion', 'runnerUp', 'semi1', 'semi2', 'bestPlayer', 'topScorer', 'bestYoung',
];
