import axios from 'axios';
import { logger } from '../config/logger';

// FotMob's per-day matches endpoint is the only one that serves JSON without a
// signed request header (the league / matchDetails endpoints are gated). It
// already carries scores and a rich status object, which is all we need.
const client = axios.create({
  baseURL: 'https://www.fotmob.com/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// FotMob groups every World Cup match (all groups + knockout rounds) under this
// parent league id.
const WC_PARENT_LEAGUE_ID = 77;

export interface FotmobMatch {
  fotmobId: number;
  utcTime: Date | null;
  homeId: number | null;
  awayId: number | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  started: boolean;
  finished: boolean;
  cancelled: boolean;
  eliminatedTeamId: number | null;
}

function toYyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseTeam(team: any): { id: number | null; name: string; score: number | null } {
  return {
    id: typeof team?.id === 'number' ? team.id : null,
    name: (team?.name ?? team?.longName ?? '').toString(),
    score: typeof team?.score === 'number' ? team.score : null,
  };
}

/** Fetch all World Cup matches FotMob lists for a single UTC day. */
export async function fetchWcMatchesForDate(date: Date): Promise<FotmobMatch[]> {
  const response = await client.get('/data/matches', { params: { date: toYyyymmdd(date) } });
  const leagues = Array.isArray(response.data?.leagues) ? response.data.leagues : [];

  const matches: FotmobMatch[] = [];
  for (const league of leagues) {
    if (league?.parentLeagueId !== WC_PARENT_LEAGUE_ID) continue;
    for (const raw of league.matches ?? []) {
      const status = raw?.status ?? {};
      const home = parseTeam(raw?.home);
      const away = parseTeam(raw?.away);
      matches.push({
        fotmobId: raw?.id,
        utcTime: status.utcTime ? new Date(status.utcTime) : null,
        homeId: home.id,
        awayId: away.id,
        homeName: home.name,
        awayName: away.name,
        homeScore: home.score,
        awayScore: away.score,
        started: !!status.started,
        finished: !!status.finished,
        cancelled: !!status.cancelled,
        eliminatedTeamId: typeof raw?.eliminatedTeamId === 'number' ? raw.eliminatedTeamId : null,
      });
    }
  }
  return matches;
}

/**
 * Fetch World Cup matches across a window of UTC days and de-duplicate by match
 * id. A window is used because a match's UTC day can differ from the day FotMob
 * files it under (late kickoffs crossing midnight).
 */
export async function fetchWcMatches(daysBack: number, daysForward: number): Promise<FotmobMatch[]> {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const byId = new Map<number, FotmobMatch>();

  for (let offset = -daysBack; offset <= daysForward; offset += 1) {
    const date = new Date(now.getTime() + offset * dayMs);
    try {
      const dayMatches = await fetchWcMatchesForDate(date);
      for (const match of dayMatches) {
        if (typeof match.fotmobId === 'number') byId.set(match.fotmobId, match);
      }
    } catch (error) {
      logger.warn({ err: error, date: toYyyymmdd(date) }, 'FotMob fetch failed for date');
    }
  }

  return Array.from(byId.values());
}
