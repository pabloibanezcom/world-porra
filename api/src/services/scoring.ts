import { IMatchOdds, MatchStage, MatchWinner } from '../models/Match';

const KNOCKOUT_STAGES = new Set<MatchStage>([
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
]);

const KNOCKOUT_ROUND_MULTIPLIERS: Record<MatchStage, number> = {
  GROUP: 0,
  ROUND_OF_32: 2,
  ROUND_OF_16: 3,
  QUARTER_FINAL: 4,
  SEMI_FINAL: 5,
  THIRD_PLACE: 4,
  FINAL: 6,
};

const KNOCKOUT_EXACT_BONUS: Record<MatchStage, number> = {
  GROUP: 0,
  ROUND_OF_32: 6,
  ROUND_OF_16: 8,
  QUARTER_FINAL: 10,
  SEMI_FINAL: 12,
  THIRD_PLACE: 10,
  FINAL: 15,
};

export interface ScoreInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stage: MatchStage;
  odds?: IMatchOdds | null;
  // Knockout only
  qualifier?: 'HOME' | 'AWAY' | null;
  actualWinner?: MatchWinner | null;
}

function getOutcome(home: number, away: number): 'HOME' | 'AWAY' | 'DRAW' {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function calculateGroupPoints(input: ScoreInput): number {
  const { predictedHome, predictedAway, actualHome, actualAway, odds } = input;

  const predictedOutcome = getOutcome(predictedHome, predictedAway);
  const actualOutcome = getOutcome(actualHome, actualAway);

  if (predictedOutcome !== actualOutcome) return 0;

  let chosenOdds: number | null = null;
  if (odds) {
    if (predictedOutcome === 'HOME') chosenOdds = odds.home;
    else if (predictedOutcome === 'AWAY') chosenOdds = odds.away;
    else chosenOdds = odds.draw;
  }

  // Fallback to 2 pts if no odds available
  const outcomePts = chosenOdds && chosenOdds > 0 ? Math.round(chosenOdds * 2) : 2;
  const exactBonus = predictedHome === actualHome && predictedAway === actualAway ? 5 : 0;

  return Math.min(outcomePts + exactBonus, 20);
}

function calculateKnockoutPoints(input: ScoreInput): number {
  const { predictedHome, predictedAway, actualHome, actualAway, stage, odds, qualifier, actualWinner } = input;

  let advancingPts = 0;
  if (qualifier && actualWinner && qualifier === actualWinner) {
    const advancingOdds = qualifier === 'HOME' ? odds?.home : odds?.away;
    advancingPts = advancingOdds && advancingOdds > 0
      ? Math.round(advancingOdds * KNOCKOUT_ROUND_MULTIPLIERS[stage])
      : KNOCKOUT_ROUND_MULTIPLIERS[stage];
  }

  const isExact = predictedHome === actualHome && predictedAway === actualAway;
  const exactBonus = isExact ? KNOCKOUT_EXACT_BONUS[stage] : 0;

  return advancingPts + exactBonus;
}

export function calculatePoints(input: ScoreInput): number {
  if (KNOCKOUT_STAGES.has(input.stage)) {
    return calculateKnockoutPoints(input);
  }
  return calculateGroupPoints(input);
}

// Frontend helpers — exported for use in points preview components
export { KNOCKOUT_ROUND_MULTIPLIERS, KNOCKOUT_EXACT_BONUS, KNOCKOUT_STAGES };
