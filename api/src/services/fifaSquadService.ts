import axios from 'axios';

export type FifaPlayerPosition = 'FW' | 'MF' | 'DF' | 'GK';

export interface FifaSquadPlayer {
  name: string;
  pos: FifaPlayerPosition;
  age: number;
  shirtNumber?: number;
}

interface LocalizedDescription {
  Locale: string;
  Description: string;
}

interface FifaPageResponse {
  seasonId?: string;
  teamId?: string;
  sections?: Array<{
    entryType: string;
    entryEndpoint?: string;
  }>;
}

interface FifaSquadResponse {
  IdCompetition: string;
  IdSeason: string;
  IdTeam: string;
  IdCountry: string;
  Players?: Array<{
    PlayerName?: LocalizedDescription[];
    ShortName?: LocalizedDescription[];
    JerseyNum?: number;
    Position: number;
    BirthDate?: string | null;
  }>;
}

const FIFA_CXM_BASE_URL = 'https://cxm-api.fifa.com/fifaplusweb/api';
const FIFA_FDCP_BASE_URL = 'https://api.fifa.com/api/v3';
const FIFA_WORLD_CUP_2026_TEAMS_PATH = '/tournaments/mens/worldcup/canadamexicousa2026/teams';
const AGE_REFERENCE_DATE = new Date('2026-06-11T00:00:00Z');

const POSITION_MAP: Record<number, FifaPlayerPosition> = {
  0: 'GK',
  1: 'DF',
  2: 'MF',
  3: 'FW',
};

function getDescription(values: LocalizedDescription[] | undefined): string {
  return values?.[0]?.Description?.trim() ?? '';
}

function titleCaseFifaName(name: string): string {
  return name
    .toLocaleLowerCase('en-US')
    .split(/(\s+|-|')/u)
    .map((part) => {
      if (/^\p{L}/u.test(part)) return part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1);
      return part;
    })
    .join('');
}

export function calculateAgeOnDate(birthDate: string, referenceDate = AGE_REFERENCE_DATE): number {
  const birth = new Date(birthDate);
  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  const referenceMonth = referenceDate.getUTCMonth();
  const birthMonth = birth.getUTCMonth();
  const hasBirthdayPassed =
    referenceMonth > birthMonth ||
    (referenceMonth === birthMonth && referenceDate.getUTCDate() >= birth.getUTCDate());

  if (!hasBirthdayPassed) age -= 1;
  return age;
}

export function mapFifaSquadPlayer(player: NonNullable<FifaSquadResponse['Players']>[number]): FifaSquadPlayer | null {
  const pos = POSITION_MAP[player.Position];
  const rawName = getDescription(player.PlayerName) || getDescription(player.ShortName);
  if (!pos || !rawName || !player.BirthDate) return null;

  return {
    name: titleCaseFifaName(rawName),
    pos,
    age: calculateAgeOnDate(player.BirthDate),
    ...(player.JerseyNum != null ? { shirtNumber: player.JerseyNum } : {}),
  };
}

export async function fetchFifaTeamPage(slug: string, locale = 'es'): Promise<FifaPageResponse> {
  const path = `/pages/${locale}${FIFA_WORLD_CUP_2026_TEAMS_PATH}/${slug}/squad`;
  const response = await axios.get<FifaPageResponse>(`${FIFA_CXM_BASE_URL}${path}`, { timeout: 10000 });
  return response.data;
}

export async function fetchFifaSquad({
  slug,
  locale = 'es',
}: {
  slug: string;
  locale?: string;
}): Promise<FifaSquadPlayer[]> {
  const page = await fetchFifaTeamPage(slug, locale);
  const dataEndpoint = page.sections?.find((section) => section.entryType === 'EntireSquad')?.entryEndpoint;
  if (!page.teamId || !page.seasonId || !dataEndpoint) {
    throw new Error(`Missing FIFA squad page metadata for ${slug}`);
  }

  const sectionResponse = await axios.get<{
    competitionId?: string;
    teamId?: string;
    seasonId?: string;
  }>(`${FIFA_CXM_BASE_URL}/${dataEndpoint.replace(/^\//u, '')}`, { timeout: 10000 });

  const teamId = sectionResponse.data.teamId ?? page.teamId;
  const seasonId = sectionResponse.data.seasonId ?? page.seasonId;
  const competitionId = sectionResponse.data.competitionId;
  if (!competitionId) throw new Error(`Missing FIFA competition id for ${slug}`);

  const squadResponse = await axios.get<FifaSquadResponse>(
    `${FIFA_FDCP_BASE_URL}/teams/${teamId}/squad`,
    {
      params: { idCompetition: competitionId, idSeason: seasonId, language: locale },
      timeout: 10000,
    }
  );

  return (squadResponse.data.Players ?? [])
    .sort((a, b) => (a.JerseyNum ?? 999) - (b.JerseyNum ?? 999))
    .map(mapFifaSquadPlayer)
    .filter((player): player is FifaSquadPlayer => player !== null);
}
