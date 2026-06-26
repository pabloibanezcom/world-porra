import axios from 'axios';
import { Match } from '../models/Match';
import { CountryTeam } from '../models/CountryTeam';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { MatchStage } from '../shared';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_STALE_HOURS = 12;
const MATCH_TIME_TOLERANCE_MS = 2 * 60 * 60 * 1000;

const KNOCKOUT_STAGES = new Set<MatchStage>([
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
]);
const KNOCKOUT_STAGE_LIST = Array.from(KNOCKOUT_STAGES);

const ODDS_TEAM_ALIASES: Record<string, string> = {
  'cape verde': 'CPV',
  'congo dr': 'COD',
  'cote divoire': 'CIV',
  curacao: 'CUW',
  czechia: 'CZE',
  'czech republic': 'CZE',
  'democratic republic of the congo': 'COD',
  'dr congo': 'COD',
  haiti: 'HAI',
  iran: 'IRN',
  'ir iran': 'IRN',
  'ivory coast': 'CIV',
  'korea republic': 'KOR',
  'saudi arabia': 'KSA',
  'south korea': 'KOR',
  usa: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
};

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

interface MatchOdds {
  home: number | null;
  draw: number | null;
  away: number | null;
}

interface SyncOddsOptions {
  force?: boolean;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function averageOdds(event: OddsApiEvent, marketKey = 'h2h'): MatchOdds {
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];
  const normalizedHome = normalizeName(event.home_team);
  const normalizedAway = normalizeName(event.away_team);

  for (const bookmaker of event.bookmakers) {
    const market = bookmaker.markets.find((m) => m.key === marketKey);
    if (!market) continue;

    const homeOutcome = market.outcomes.find((o) => normalizeName(o.name) === normalizedHome);
    const awayOutcome = market.outcomes.find((o) => normalizeName(o.name) === normalizedAway);
    const drawOutcome = market.outcomes.find((o) => normalizeName(o.name) === 'draw');

    if (homeOutcome) homePrices.push(homeOutcome.price);
    if (awayOutcome) awayPrices.push(awayOutcome.price);
    if (drawOutcome) drawPrices.push(drawOutcome.price);
  }

  const avg = (prices: number[]) =>
    prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  return { home: avg(homePrices), draw: avg(drawPrices), away: avg(awayPrices) };
}

function hasUsableGroupOdds(odds: MatchOdds): boolean {
  return Boolean(odds.home && odds.draw && odds.away);
}

function hasUsableKnockoutOdds(odds: MatchOdds): boolean {
  return Boolean(odds.home && odds.away && !odds.draw);
}

function deriveKnockoutOddsFromThreeWay(odds: MatchOdds): MatchOdds | null {
  if (!odds.home || !odds.away || !odds.draw) return null;

  const homeImplied = 1 / odds.home;
  const awayImplied = 1 / odds.away;
  const nonDrawTotal = homeImplied + awayImplied;
  if (nonDrawTotal <= 0) return null;

  const toDecimal = (probability: number) => Math.round((1 / probability) * 100) / 100;
  return {
    home: toDecimal(homeImplied / nonDrawTotal),
    draw: null,
    away: toDecimal(awayImplied / nonDrawTotal),
  };
}

function oddsForMatch(event: OddsApiEvent, stage: MatchStage): MatchOdds | null {
  const h2h = averageOdds(event, 'h2h');

  if (!KNOCKOUT_STAGES.has(stage)) {
    return hasUsableGroupOdds(h2h) ? h2h : null;
  }

  // Our knockout scoring uses "to qualify" prices. The Odds API's soccer h2h
  // market can be either two-outcome or regular-time 1X2. When only 1X2 exists,
  // derive an "advances" price by conditioning out the draw probability.
  if (hasUsableKnockoutOdds(h2h)) return h2h;
  return deriveKnockoutOddsFromThreeWay(h2h);
}

function parseRequestsRemaining(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatOddsApiTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getOddsApiErrorDetails(error: unknown): {
  status: number | null;
  errorCode: unknown;
  message: unknown;
  requestsRemaining: number | null;
} {
  const response =
    error && typeof error === 'object'
      ? (error as {
          response?: {
            status?: number;
            data?: { error_code?: unknown; message?: unknown };
            headers?: Record<string, unknown>;
          };
        }).response
      : undefined;

  return {
    status: response?.status ?? null,
    errorCode: response?.data?.error_code ?? null,
    message: response?.data?.message ?? (error instanceof Error ? error.message : null),
    requestsRemaining: parseRequestsRemaining(response?.headers?.['x-requests-remaining']),
  };
}

function findDateFallbackMatch<T extends { utcDate: Date }>(matches: T[], eventDate: Date): T | null {
  const candidates = matches.filter((m) => Math.abs(m.utcDate.getTime() - eventDate.getTime()) < MATCH_TIME_TOLERANCE_MS);
  return candidates.length === 1 ? candidates[0] : null;
}

export async function syncOdds(options: SyncOddsOptions = {}): Promise<{ matchesUpdated: number; requestsRemaining: number | null }> {
  if (!env.ODDS_API_KEY) {
    logger.warn('ODDS_API_KEY not configured — skipping odds sync');
    return { matchesUpdated: 0, requestsRemaining: null };
  }

  const staleCutoff = new Date(Date.now() - ODDS_STALE_HOURS * 60 * 60 * 1000);
  const matches = await Match.find({
    status: { $in: ['SCHEDULED', 'LIVE'] },
    ...(options.force
      ? {}
      : {
          $or: [
            { odds: null },
            { 'odds.fetchedAt': { $lt: staleCutoff } },
            { stage: { $in: KNOCKOUT_STAGE_LIST }, 'odds.draw': { $ne: null } },
          ],
        }),
  });

  if (matches.length === 0) {
    logger.info('No matches need odds refresh');
    return { matchesUpdated: 0, requestsRemaining: null };
  }

  // Build name→code lookup from CountryTeam catalog
  const teams = await CountryTeam.find({});
  const nameToCode = new Map<string, string>();
  for (const team of teams) {
    nameToCode.set(normalizeName(team.code), team.code);
    const names = team.names instanceof Map ? team.names : new Map(Object.entries(team.names as Record<string, string>));
    for (const name of names.values()) {
      if (name) nameToCode.set(normalizeName(name), team.code);
    }
  }
  for (const [name, code] of Object.entries(ODDS_TEAM_ALIASES)) {
    nameToCode.set(normalizeName(name), code);
  }

  const timestamps = matches.map((match) => match.utcDate.getTime());
  const earliest = formatOddsApiTimestamp(new Date(Math.min(...timestamps) - MATCH_TIME_TOLERANCE_MS));
  const latest = formatOddsApiTimestamp(new Date(Math.max(...timestamps) + MATCH_TIME_TOLERANCE_MS));

  // Fetch all odds in a single API call
  let events: OddsApiEvent[] = [];
  let requestsRemaining: number | null = null;

  try {
    const response = await axios.get<OddsApiEvent[]>(`${ODDS_API_BASE}/sports/${env.ODDS_API_SPORT_KEY}/odds`, {
      params: {
        apiKey: env.ODDS_API_KEY,
        regions: 'eu',
        markets: 'h2h',
        oddsFormat: 'decimal',
        commenceTimeFrom: earliest,
        commenceTimeTo: latest,
      },
    });
    events = response.data;
    requestsRemaining = parseRequestsRemaining(response.headers['x-requests-remaining']);
    logger.info({ count: events.length, requestsRemaining }, 'Fetched odds from API');
  } catch (err) {
    const errorDetails = getOddsApiErrorDetails(err);
    logger.error(errorDetails, 'Failed to fetch odds from The Odds API');
    return { matchesUpdated: 0, requestsRemaining: errorDetails.requestsRemaining };
  }

  // Index our matches by homeCode+awayCode for quick lookup
  const matchIndex = new Map<string, (typeof matches)[number]>();
  for (const match of matches) {
    matchIndex.set(`${match.homeTeamCode}:${match.awayTeamCode}`, match);
  }

  let matchesUpdated = 0;
  let eventsSkipped = 0;

  for (const event of events) {
    const homeCode = nameToCode.get(normalizeName(event.home_team));
    const awayCode = nameToCode.get(normalizeName(event.away_team));
    const eventDate = new Date(event.commence_time);
    let match: (typeof matches)[number] | null = null;
    let reverseOdds = false;

    if (!homeCode || !awayCode) {
      // Only fall back by date when there is a single possible match. World Cup
      // group games can overlap, and guessing there would corrupt the odds.
      match = findDateFallbackMatch(matches, eventDate);
    } else {
      match = matchIndex.get(`${homeCode}:${awayCode}`) ?? null;
      if (!match) {
        match = matchIndex.get(`${awayCode}:${homeCode}`) ?? null;
        reverseOdds = Boolean(match);
      }
    }

    if (!match) {
      eventsSkipped++;
      continue;
    }

    // Verify date proximity (within 2 hours) to avoid false matches
    if (Math.abs(match.utcDate.getTime() - eventDate.getTime()) > MATCH_TIME_TOLERANCE_MS) {
      eventsSkipped++;
      continue;
    }

    const computed = oddsForMatch(event, match.stage);
    if (!computed) {
      eventsSkipped++;
      continue;
    }
    const odds = reverseOdds
      ? { home: computed.away, draw: computed.draw, away: computed.home, fetchedAt: new Date() }
      : { ...computed, fetchedAt: new Date() };
    await Match.updateOne({ _id: match._id }, { $set: { odds } }, { runValidators: false });
    matchesUpdated++;
  }

  logger.info({ matchesUpdated, eventsSkipped, requestsRemaining }, 'Odds sync complete');
  return { matchesUpdated, requestsRemaining };
}
