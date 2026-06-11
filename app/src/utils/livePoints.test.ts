import { describe, expect, it } from 'vitest';
import { Match, Prediction } from '../types';
import { calculateLivePotentialPoints } from './livePoints';

const baseMatch: Match = {
  _id: 'match-1',
  externalId: 1,
  stage: 'GROUP',
  group: 'A',
  matchday: 1,
  homeTeamCode: 'USA',
  awayTeamCode: 'CAN',
  homeTeam: { code: 'USA', name: 'United States', crest: '', color: '#0052b4' },
  awayTeam: { code: 'CAN', name: 'Canada', crest: '', color: '#d80027' },
  utcDate: '2026-06-11T19:00:00.000Z',
  status: 'LIVE',
  result: { homeGoals: 1, awayGoals: 0, winner: 'HOME' },
  odds: { home: 2.2, draw: 3.1, away: 3.4 },
};

const basePrediction: Prediction = {
  _id: 'prediction-1',
  userId: 'user-1',
  matchId: 'match-1',
  homeGoals: 1,
  awayGoals: 0,
  predictedWinner: 'HOME',
  qualifier: null,
  points: null,
};

describe('calculateLivePotentialPoints', () => {
  it('returns current exact-score points for a live group match', () => {
    expect(calculateLivePotentialPoints(baseMatch, basePrediction)).toBe(9);
  });

  it('returns zero when the current live outcome misses the prediction', () => {
    expect(
      calculateLivePotentialPoints(baseMatch, {
        ...basePrediction,
        homeGoals: 0,
        awayGoals: 1,
      })
    ).toBe(0);
  });

  it('returns null when the live match has no current score', () => {
    expect(calculateLivePotentialPoints({ ...baseMatch, result: null }, basePrediction)).toBeNull();
  });
});
