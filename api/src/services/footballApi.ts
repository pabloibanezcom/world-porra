import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { MatchStage, MatchStatus } from '../models/Match';

const client = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
  timeout: 10000,
});

// WC 2026 competition code — may need updating when football-data.org publishes it
const COMPETITION_CODE = 'WC';

interface FootballDataMatch {
  id: number;
  stage: string;
  group: string | null;
  matchday: number;
  homeTeam: { name: string | null; tla: string | null; crest: string | null };
  awayTeam: { name: string | null; tla: string | null; crest: string | null };
  utcDate: string;
  status: string;
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: string | null;
  };
}

const STAGE_MAP: Record<string, MatchStage> = {
  GROUP_STAGE: 'GROUP',
  LAST_32: 'ROUND_OF_32',
  LAST_16: 'ROUND_OF_16',
  QUARTER_FINALS: 'QUARTER_FINAL',
  SEMI_FINALS: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
};

const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'SCHEDULED',
  IN_PLAY: 'LIVE',
  PAUSED: 'LIVE',
  FINISHED: 'FINISHED',
  SUSPENDED: 'POSTPONED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'POSTPONED',
  AWARDED: 'FINISHED',
};

function mapStage(stage: string): MatchStage {
  const mapped = STAGE_MAP[stage];
  if (!mapped) {
    throw new Error(`Unsupported football-data stage: ${stage}`);
  }

  return mapped;
}

function mapStatus(status: string): MatchStatus {
  const mapped = STATUS_MAP[status];
  if (!mapped) {
    throw new Error(`Unsupported football-data status: ${status}`);
  }

  return mapped;
}

function mapGroup(group: string | null): string | null {
  if (!group) return null;
  if (group.startsWith('GROUP_')) return group.replace('GROUP_', '');
  return group;
}

function mapTeamName(name: string | null): string {
  return name?.trim() || 'TBD';
}

function mapTeamCode(team: { name: string | null; tla: string | null }): string {
  if (team.tla) return team.tla;
  if (!team.name) return 'TBD';

  return team.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export async function fetchAllMatches(): Promise<FootballDataMatch[]> {
  try {
    const response = await client.get(`/competitions/${COMPETITION_CODE}/matches`);
    return response.data.matches;
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch matches from football-data.org');
    throw error;
  }
}

export function mapExternalMatch(ext: FootballDataMatch) {
  const stage = mapStage(ext.stage);
  const status = mapStatus(ext.status);
  const winner =
    ext.score.fullTime.home != null && ext.score.fullTime.away != null
      ? ext.score.fullTime.home > ext.score.fullTime.away
        ? 'HOME'
        : ext.score.fullTime.away > ext.score.fullTime.home
          ? 'AWAY'
          : 'DRAW'
      : null;

  const homeTeamName = mapTeamName(ext.homeTeam.name);
  const awayTeamName = mapTeamName(ext.awayTeam.name);
  const homeTeamCode = mapTeamCode(ext.homeTeam);
  const awayTeamCode = mapTeamCode(ext.awayTeam);

  return {
    externalId: ext.id,
    stage,
    group: mapGroup(ext.group),
    matchday: ext.matchday,
    homeTeamCode,
    awayTeamCode,
    sourceTeams: {
      home: { name: homeTeamName, code: homeTeamCode, crest: ext.homeTeam.crest || '' },
      away: { name: awayTeamName, code: awayTeamCode, crest: ext.awayTeam.crest || '' },
    },
    utcDate: new Date(ext.utcDate),
    status,
    result:
      status === 'FINISHED' && ext.score.fullTime.home != null
        ? {
            homeGoals: ext.score.fullTime.home!,
            awayGoals: ext.score.fullTime.away!,
            winner: winner!,
          }
        : null,
  };
}
