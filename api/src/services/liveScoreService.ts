import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { IMatchResult, MatchStatus, MatchWinner } from '../models/Match';

type MatchForLiveScore = {
  utcDate: Date | string;
  status: MatchStatus;
  homeTeamCode: string;
  awayTeamCode: string;
  result?: IMatchResult | null;
};

type LiveScore = {
  homeGoals: number;
  awayGoals: number;
  winner: MatchWinner;
};

type ESPNCompetitor = {
  homeAway: 'home' | 'away';
  score?: string;
  team?: {
    abbreviation?: string;
  };
};

type ESPNCompetition = {
  status?: {
    type?: {
      state?: string;
    };
  };
  competitors?: ESPNCompetitor[];
};

type ESPNEvent = {
  competitions?: ESPNCompetition[];
};

type ESPNScoreboard = {
  events?: ESPNEvent[];
};

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const client = axios.create({
  baseURL: ESPN_SCOREBOARD_URL,
  timeout: 5000,
});

const scoreCache = new Map<string, { expiresAt: number; scores: Map<string, LiveScore> }>();
const pendingFetches = new Map<string, Promise<Map<string, LiveScore>>>();

function deriveWinner(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function formatESPNDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

function normalizeCode(code: string | null | undefined): string {
  return code?.trim().toUpperCase() || 'TBD';
}

function scoreKey(homeCode: string, awayCode: string): string {
  return `${normalizeCode(homeCode)}:${normalizeCode(awayCode)}`;
}

function parseScore(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function makeMockLiveScore(match: MatchForLiveScore): LiveScore {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const seed = stableNumber(`${match.homeTeamCode}:${match.awayTeamCode}`);
  const homeGoals = (seed + minuteBucket) % 4;
  const awayGoals = (Math.floor(seed / 7) + Math.floor(minuteBucket / 2)) % 3;

  return {
    homeGoals,
    awayGoals,
    winner: deriveWinner(homeGoals, awayGoals),
  };
}

function mapESPNScoreboard(data: ESPNScoreboard): Map<string, LiveScore> {
  const scores = new Map<string, LiveScore>();

  for (const event of data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const state = competition?.status?.type?.state;
    if (state !== 'in') continue;

    const home = competition.competitors?.find((competitor) => competitor.homeAway === 'home');
    const away = competition.competitors?.find((competitor) => competitor.homeAway === 'away');
    const homeGoals = parseScore(home?.score);
    const awayGoals = parseScore(away?.score);
    const homeCode = normalizeCode(home?.team?.abbreviation);
    const awayCode = normalizeCode(away?.team?.abbreviation);

    if (homeGoals == null || awayGoals == null || homeCode === 'TBD' || awayCode === 'TBD') continue;

    scores.set(scoreKey(homeCode, awayCode), {
      homeGoals,
      awayGoals,
      winner: deriveWinner(homeGoals, awayGoals),
    });
  }

  return scores;
}

async function fetchScoresForDate(date: string): Promise<Map<string, LiveScore>> {
  const now = Date.now();
  const cached = scoreCache.get(date);
  if (cached && cached.expiresAt > now) {
    return cached.scores;
  }

  const pending = pendingFetches.get(date);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    const response = await client.get<ESPNScoreboard>('', { params: { dates: date } });
    const scores = mapESPNScoreboard(response.data);
    scoreCache.set(date, { scores, expiresAt: now + env.LIVE_SCORE_CACHE_SECONDS * 1000 });
    return scores;
  })();

  pendingFetches.set(date, fetchPromise);

  try {
    return await fetchPromise;
  } catch (error) {
    logger.warn({ err: error, date }, 'Failed to fetch live scores from ESPN scoreboard');
    return cached?.scores ?? new Map();
  } finally {
    pendingFetches.delete(date);
  }
}

export async function applyLiveScores<T extends MatchForLiveScore>(matches: T[]): Promise<T[]> {
  const liveMatches = matches.filter((match) => match.status === 'LIVE');
  if (liveMatches.length === 0) {
    return matches;
  }

  const dates = Array.from(new Set(liveMatches.map((match) => formatESPNDate(match.utcDate))));
  const dateScores = new Map<string, Map<string, LiveScore>>();

  await Promise.all(
    dates.map(async (date) => {
      dateScores.set(date, await fetchScoresForDate(date));
    })
  );

  return matches.map((match) => {
    if (match.status !== 'LIVE') return match;

    const date = formatESPNDate(match.utcDate);
    const score = dateScores.get(date)?.get(scoreKey(match.homeTeamCode, match.awayTeamCode));
    if (!score && !env.MOCK_LIVE_SCORES) return match;

    return {
      ...match,
      result: score ?? makeMockLiveScore(match),
    };
  });
}
