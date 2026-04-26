export interface TeamOption {
  name: string;
  nameEs?: string;
  code: string;
}

export interface PlayerOption {
  name: string;
  team: string;
  code: string;
  pos: 'FW' | 'MF' | 'DF' | 'GK';
}

export const ALL_TEAMS: TeamOption[] = [
  { name: 'Argentina', code: 'ARG' },
  { name: 'Australia', code: 'AUS' },
  { name: 'Belgium', nameEs: 'Bélgica', code: 'BEL' },
  { name: 'Bolivia', code: 'BOL' },
  { name: 'Brazil', nameEs: 'Brasil', code: 'BRA' },
  { name: 'Cameroon', nameEs: 'Camerún', code: 'CMR' },
  { name: 'Canada', nameEs: 'Canadá', code: 'CAN' },
  { name: 'Chile', code: 'CHI' },
  { name: 'Colombia', code: 'COL' },
  { name: 'Costa Rica', code: 'CRC' },
  { name: 'Croatia', nameEs: 'Croacia', code: 'CRO' },
  { name: 'Ecuador', code: 'ECU' },
  { name: 'Egypt', nameEs: 'Egipto', code: 'EGY' },
  { name: 'England', nameEs: 'Inglaterra', code: 'ENG' },
  { name: 'France', nameEs: 'Francia', code: 'FRA' },
  { name: 'Germany', nameEs: 'Alemania', code: 'GER' },
  { name: 'Ghana', code: 'GHA' },
  { name: 'Ivory Coast', nameEs: 'Costa de Marfil', code: 'CIV' },
  { name: 'Japan', nameEs: 'Japón', code: 'JPN' },
  { name: 'Kenya', nameEs: 'Kenia', code: 'KEN' },
  { name: 'Mexico', nameEs: 'México', code: 'MEX' },
  { name: 'Morocco', nameEs: 'Marruecos', code: 'MAR' },
  { name: 'Netherlands', nameEs: 'Países Bajos', code: 'NED' },
  { name: 'Nigeria', code: 'NGA' },
  { name: 'Panama', nameEs: 'Panamá', code: 'PAN' },
  { name: 'Paraguay', code: 'PAR' },
  { name: 'Peru', nameEs: 'Perú', code: 'PER' },
  { name: 'Portugal', code: 'POR' },
  { name: 'Saudi Arabia', nameEs: 'Arabia Saudí', code: 'KSA' },
  { name: 'Senegal', code: 'SEN' },
  { name: 'Serbia', code: 'SER' },
  { name: 'South Korea', nameEs: 'Corea del Sur', code: 'KOR' },
  { name: 'Spain', nameEs: 'España', code: 'ESP' },
  { name: 'Tunisia', nameEs: 'Túnez', code: 'TUN' },
  { name: 'United States', nameEs: 'Estados Unidos', code: 'USA' },
  { name: 'Uruguay', code: 'URU' },
  { name: 'Venezuela', code: 'VEN' },
];

export const AWARD_PLAYERS: Record<string, PlayerOption[]> = {
  bestPlayer: [
    { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW' },
    { name: 'Kylian Mbappé', team: 'France', code: 'FRA', pos: 'FW' },
    { name: 'Erling Haaland', team: 'Norway', code: 'NOR', pos: 'FW' },
    { name: 'Vinicius Jr.', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Pedri', team: 'Spain', code: 'ESP', pos: 'MF' },
    { name: 'Rodri', team: 'Spain', code: 'ESP', pos: 'MF' },
    { name: 'Jude Bellingham', team: 'England', code: 'ENG', pos: 'MF' },
    { name: 'Lamine Yamal', team: 'Spain', code: 'ESP', pos: 'FW' },
    { name: 'Phil Foden', team: 'England', code: 'ENG', pos: 'MF' },
    { name: 'Bukayo Saka', team: 'England', code: 'ENG', pos: 'FW' },
    { name: 'Florian Wirtz', team: 'Germany', code: 'GER', pos: 'MF' },
    { name: 'Rafael Leão', team: 'Portugal', code: 'POR', pos: 'FW' },
    { name: 'Achraf Hakimi', team: 'Morocco', code: 'MAR', pos: 'DF' },
    { name: 'Neymar Jr.', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Bruno Fernandes', team: 'Portugal', code: 'POR', pos: 'MF' },
  ],
  topScorer: [
    { name: 'Kylian Mbappé', team: 'France', code: 'FRA', pos: 'FW' },
    { name: 'Erling Haaland', team: 'Norway', code: 'NOR', pos: 'FW' },
    { name: 'Vinicius Jr.', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW' },
    { name: 'Harry Kane', team: 'England', code: 'ENG', pos: 'FW' },
    { name: 'Lautaro Martínez', team: 'Argentina', code: 'ARG', pos: 'FW' },
    { name: 'Cristiano Ronaldo', team: 'Portugal', code: 'POR', pos: 'FW' },
    { name: 'Romelu Lukaku', team: 'Belgium', code: 'BEL', pos: 'FW' },
    { name: 'Darwin Núñez', team: 'Uruguay', code: 'URU', pos: 'FW' },
    { name: 'Lamine Yamal', team: 'Spain', code: 'ESP', pos: 'FW' },
    { name: 'Richarlison', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Memphis Depay', team: 'Netherlands', code: 'NED', pos: 'FW' },
    { name: 'Álvaro Morata', team: 'Spain', code: 'ESP', pos: 'FW' },
    { name: 'Serhou Guirassy', team: 'Germany', code: 'GER', pos: 'FW' },
    { name: 'Kai Havertz', team: 'Germany', code: 'GER', pos: 'FW' },
  ],
  bestYoung: [
    { name: 'Lamine Yamal', team: 'Spain', code: 'ESP', pos: 'FW' },
    { name: 'Pedri', team: 'Spain', code: 'ESP', pos: 'MF' },
    { name: 'Gavi', team: 'Spain', code: 'ESP', pos: 'MF' },
    { name: 'Florian Wirtz', team: 'Germany', code: 'GER', pos: 'MF' },
    { name: 'Jude Bellingham', team: 'England', code: 'ENG', pos: 'MF' },
    { name: 'Warren Zaïre-Emery', team: 'France', code: 'FRA', pos: 'MF' },
    { name: 'Endrick', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Xavi Simons', team: 'Netherlands', code: 'NED', pos: 'MF' },
    { name: 'Alejandro Garnacho', team: 'Argentina', code: 'ARG', pos: 'FW' },
    { name: 'Matthijs de Ligt', team: 'Netherlands', code: 'NED', pos: 'DF' },
    { name: 'Evan Ndicka', team: 'Ivory Coast', code: 'CIV', pos: 'DF' },
    { name: 'Rasmus Højlund', team: 'Denmark', code: 'DEN', pos: 'FW' },
    { name: 'Bradley Barcola', team: 'France', code: 'FRA', pos: 'FW' },
    { name: 'Savinho', team: 'Brazil', code: 'BRA', pos: 'FW' },
    { name: 'Pau Cubarsí', team: 'Spain', code: 'ESP', pos: 'DF' },
  ],
};

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
