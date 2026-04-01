import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

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
  homeTeam: { name: string; tla: string; crest: string };
  awayTeam: { name: string; tla: string; crest: string };
  utcDate: string;
  status: string;
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: string | null;
  };
}

export async function fetchAllMatches(): Promise<FootballDataMatch[]> {
  try {
    const response = await client.get(`/competitions/${COMPETITION_CODE}/matches`);
    return response.data.matches;
  } catch (error) {
    logger.error('Failed to fetch matches from football-data.org', error);
    throw error;
  }
}

export async function fetchFinishedMatches(dateFrom: string, dateTo: string): Promise<FootballDataMatch[]> {
  try {
    const response = await client.get(`/competitions/${COMPETITION_CODE}/matches`, {
      params: { status: 'FINISHED', dateFrom, dateTo },
    });
    return response.data.matches;
  } catch (error) {
    logger.error('Failed to fetch finished matches', error);
    throw error;
  }
}

export function mapExternalMatch(ext: FootballDataMatch) {
  const winner =
    ext.score.fullTime.home != null && ext.score.fullTime.away != null
      ? ext.score.fullTime.home > ext.score.fullTime.away
        ? 'HOME'
        : ext.score.fullTime.away > ext.score.fullTime.home
          ? 'AWAY'
          : 'DRAW'
      : null;

  return {
    externalId: ext.id,
    stage: ext.stage,
    group: ext.group,
    matchday: ext.matchday,
    homeTeam: { name: ext.homeTeam.name, code: ext.homeTeam.tla, crest: ext.homeTeam.crest },
    awayTeam: { name: ext.awayTeam.name, code: ext.awayTeam.tla, crest: ext.awayTeam.crest },
    utcDate: new Date(ext.utcDate),
    status: ext.status,
    result:
      ext.status === 'FINISHED' && ext.score.fullTime.home != null
        ? {
            homeGoals: ext.score.fullTime.home!,
            awayGoals: ext.score.fullTime.away!,
            winner: winner!,
          }
        : null,
  };
}
