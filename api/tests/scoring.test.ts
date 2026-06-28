import { describe, it, expect } from 'vitest';
import { calculatePoints } from '../src/services/scoring';
import type { ScoreInput } from '../src/services/scoring';

function groupScore(
  predicted: [number, number],
  actual: [number, number],
  odds?: { home: number; draw: number; away: number },
): number {
  return calculatePoints({
    predictedHome: predicted[0],
    predictedAway: predicted[1],
    actualHome: actual[0],
    actualAway: actual[1],
    stage: 'GROUP',
    odds: odds ? { ...odds, fetchedAt: new Date() } : null,
  });
}

function knockoutScore(input: {
  predicted: [number, number];
  actual: [number, number];
  stage: ScoreInput['stage'];
  qualifier?: 'HOME' | 'AWAY' | null;
  actualWinner?: 'HOME' | 'AWAY' | 'DRAW';
  odds?: { home: number; away: number };
}): number {
  return calculatePoints({
    predictedHome: input.predicted[0],
    predictedAway: input.predicted[1],
    actualHome: input.actual[0],
    actualAway: input.actual[1],
    stage: input.stage,
    qualifier: input.qualifier ?? null,
    actualWinner: input.actualWinner ?? null,
    odds: input.odds ? { home: input.odds.home, draw: null, away: input.odds.away, fetchedAt: new Date() } : null,
  });
}

describe('calculatePoints — group stage', () => {
  it('wrong outcome → 0', () => {
    expect(groupScore([2, 0], [0, 1])).toBe(0);
    expect(groupScore([0, 0], [1, 0])).toBe(0);
    expect(groupScore([1, 0], [1, 1])).toBe(0);
  });

  it('correct outcome, no odds → 2 pts (fallback)', () => {
    expect(groupScore([2, 0], [1, 0])).toBe(2);
    expect(groupScore([0, 1], [0, 2])).toBe(2);
    expect(groupScore([0, 0], [1, 1])).toBe(2);
  });

  it('exact score, no odds → 7 pts (fallback 2 + bonus 5)', () => {
    expect(groupScore([2, 1], [2, 1])).toBe(7);
    expect(groupScore([0, 0], [0, 0])).toBe(7);
  });

  it('correct outcome with odds → Round(odds * 2)', () => {
    // Home wins, home odds = 2.0 → Round(2.0 * 2) = 4
    expect(groupScore([2, 0], [1, 0], { home: 2.0, draw: 3.5, away: 4.0 })).toBe(4);
    // Draw, draw odds = 3.2 → Round(3.2 * 2) = 6
    expect(groupScore([1, 1], [0, 0], { home: 2.0, draw: 3.2, away: 4.0 })).toBe(6);
    // Away wins, away odds = 5.5 → Round(5.5 * 2) = 11
    expect(groupScore([0, 2], [0, 1], { home: 1.5, draw: 4.0, away: 5.5 })).toBe(11);
  });

  it('exact score with odds → Round(odds * 2) + 5, capped at 20', () => {
    // Home odds = 2.0 → Round(2.0*2)+5 = 9
    expect(groupScore([2, 1], [2, 1], { home: 2.0, draw: 3.5, away: 4.0 })).toBe(9);
    // High odds exact: away odds = 8.0 → Round(8*2)+5 = 21 → capped at 20
    expect(groupScore([0, 3], [0, 3], { home: 1.2, draw: 6.0, away: 8.0 })).toBe(20);
  });

  it('cap at 20 points per match', () => {
    // away odds = 9.0 → 18 + 5 = 23 → capped at 20
    expect(groupScore([0, 1], [0, 1], { home: 1.1, draw: 6.0, away: 9.0 })).toBe(20);
  });

  it('rounding: 0.5 rounds up (standard rounding)', () => {
    // home odds = 2.25 → Round(2.25 * 2) = Round(4.5) = 5
    expect(groupScore([1, 0], [2, 0], { home: 2.25, draw: 3.5, away: 4.0 })).toBe(5);
    // draw odds = 3.25 → Round(3.25 * 2) = Round(6.5) = 7
    expect(groupScore([0, 0], [1, 1], { home: 2.0, draw: 3.25, away: 4.0 })).toBe(7);
  });

  it('null/zero odds fields fall back to 2 pts', () => {
    // If only one odds field is null the whole oddsToPercent is null → fallback
    expect(groupScore([1, 0], [2, 0], { home: 0, draw: 3.5, away: 4.0 })).toBe(2);
  });
});

describe('calculatePoints — knockout rounds', () => {
  it('wrong qualifier → 0 advancing pts', () => {
    // Predicted HOME to qualify but AWAY won
    expect(knockoutScore({
      predicted: [1, 0],
      actual: [1, 0],
      stage: 'ROUND_OF_32',
      qualifier: 'HOME',
      actualWinner: 'AWAY',
      odds: { home: 2.0, away: 1.8 },
    })).toBe(6); // exact bonus only (6 for R32), no advancing pts
  });

  it('correct qualifier, no exact → advancing pts only', () => {
    // HOME advances, home odds = 2.0, R32 multiplier = 2 → Round(2.0*2) = 4
    expect(knockoutScore({
      predicted: [1, 0],
      actual: [2, 0],
      stage: 'ROUND_OF_32',
      qualifier: 'HOME',
      actualWinner: 'HOME',
      odds: { home: 2.0, away: 1.8 },
    })).toBe(4);
  });

  it('correct qualifier + exact score → advancing pts + exact bonus', () => {
    // HOME odds = 2.5, R16 multiplier = 3 → Round(2.5*3) = 8, plus R16 exact bonus 8 = 16
    expect(knockoutScore({
      predicted: [2, 1],
      actual: [2, 1],
      stage: 'ROUND_OF_16',
      qualifier: 'HOME',
      actualWinner: 'HOME',
      odds: { home: 2.5, away: 1.6 },
    })).toBe(16);
  });

  it('draw prediction: correct qualifier via penalties + exact score → full points', () => {
    // Draw 1-1, AWAY advances on penalties. AWAY odds = 2.2, QF multiplier = 4 → Round(8.8) = 9
    // QF exact bonus = 10. Total = 19
    expect(knockoutScore({
      predicted: [1, 1],
      actual: [1, 1],
      stage: 'QUARTER_FINAL',
      qualifier: 'AWAY',
      actualWinner: 'AWAY',
      odds: { home: 1.8, away: 2.2 },
    })).toBe(19);
  });

  it('exact score bonus varies by round', () => {
    const base = { predicted: [1, 0] as [number,number], actual: [1, 0] as [number,number], qualifier: null, actualWinner: null };
    expect(knockoutScore({ ...base, stage: 'ROUND_OF_32' })).toBe(6);
    expect(knockoutScore({ ...base, stage: 'ROUND_OF_16' })).toBe(8);
    expect(knockoutScore({ ...base, stage: 'QUARTER_FINAL' })).toBe(10);
    expect(knockoutScore({ ...base, stage: 'SEMI_FINAL' })).toBe(12);
    expect(knockoutScore({ ...base, stage: 'THIRD_PLACE' })).toBe(10);
    expect(knockoutScore({ ...base, stage: 'FINAL' })).toBe(15);
  });

  it('no qualifier → 0 advancing pts, exact bonus still applies', () => {
    expect(knockoutScore({
      predicted: [2, 1],
      actual: [2, 1],
      stage: 'SEMI_FINAL',
      qualifier: null,
      actualWinner: 'HOME',
    })).toBe(12); // exact bonus only
  });

  it('correct qualifier but no odds → round multiplier fallback, exact bonus still applies', () => {
    expect(knockoutScore({
      predicted: [1, 0],
      actual: [1, 0],
      stage: 'ROUND_OF_16',
      qualifier: 'HOME',
      actualWinner: 'HOME',
      // no odds
    })).toBe(11); // R16 fallback 3 + exact bonus 8
  });

  it('correct qualifier but zero odds → round multiplier fallback', () => {
    expect(knockoutScore({
      predicted: [1, 0],
      actual: [2, 0],
      stage: 'QUARTER_FINAL',
      qualifier: 'HOME',
      actualWinner: 'HOME',
      odds: { home: 0, away: 2.1 },
    })).toBe(4);
  });

  it('draw prediction, wrong qualifier (wrong penalty pick) → exact bonus only', () => {
    // Predicted 1-1, picked HOME to advance — but AWAY won on penalties
    expect(knockoutScore({
      predicted: [1, 1],
      actual: [1, 1],
      stage: 'QUARTER_FINAL',
      qualifier: 'HOME',
      actualWinner: 'AWAY',
      odds: { home: 1.8, away: 2.2 },
    })).toBe(10); // exact bonus only, no advancing pts
  });

  it('wrong score + wrong qualifier → 0', () => {
    expect(knockoutScore({
      predicted: [2, 0],
      actual: [0, 1],
      stage: 'ROUND_OF_32',
      qualifier: 'HOME',
      actualWinner: 'AWAY',
      odds: { home: 2.0, away: 1.8 },
    })).toBe(0);
  });

  it('wrong score + correct qualifier → advancing pts only', () => {
    // HOME advances, score wrong
    expect(knockoutScore({
      predicted: [2, 0],
      actual: [1, 0],
      stage: 'FINAL',
      qualifier: 'HOME',
      actualWinner: 'HOME',
      odds: { home: 1.5, away: 2.8 },
    })).toBe(9); // Round(1.5 * 6) = 9, no exact bonus
  });

  it('rounding in advancing pts: 0.5 rounds up', () => {
    // away odds = 2.5, SEMI multiplier = 5 → Round(12.5) = 13
    expect(knockoutScore({
      predicted: [0, 1],
      actual: [0, 2],
      stage: 'SEMI_FINAL',
      qualifier: 'AWAY',
      actualWinner: 'AWAY',
      odds: { home: 1.6, away: 2.5 },
    })).toBe(13); // advancing pts only, no exact
  });
});
