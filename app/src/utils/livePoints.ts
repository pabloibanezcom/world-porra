import { Match, MatchStage, MatchWinner, Prediction } from '../types';

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

function getOutcome(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

export function calculateLivePotentialPoints(match: Match, prediction?: Prediction | null): number | null {
  if (!prediction || !match.result) return null;

  const predictedHome = prediction.homeGoals;
  const predictedAway = prediction.awayGoals;
  const actualHome = match.result.homeGoals;
  const actualAway = match.result.awayGoals;

  if (KNOCKOUT_STAGES.has(match.stage)) {
    const actualWinner = getOutcome(actualHome, actualAway);
    let advancingPts = 0;

    if (prediction.qualifier && prediction.qualifier === actualWinner) {
      const advancingOdds = prediction.qualifier === 'HOME' ? match.odds?.home : match.odds?.away;
      if (advancingOdds && advancingOdds > 0) {
        advancingPts = Math.round(advancingOdds * KNOCKOUT_ROUND_MULTIPLIERS[match.stage]);
      }
    }

    const exactBonus = predictedHome === actualHome && predictedAway === actualAway
      ? KNOCKOUT_EXACT_BONUS[match.stage]
      : 0;

    return advancingPts + exactBonus;
  }

  const predictedOutcome = getOutcome(predictedHome, predictedAway);
  const actualOutcome = getOutcome(actualHome, actualAway);
  if (predictedOutcome !== actualOutcome) return 0;

  const chosenOdds =
    predictedOutcome === 'HOME'
      ? match.odds?.home
      : predictedOutcome === 'AWAY'
        ? match.odds?.away
        : match.odds?.draw;
  const outcomePts = chosenOdds && chosenOdds > 0 ? Math.round(chosenOdds * 2) : 2;
  const exactBonus = predictedHome === actualHome && predictedAway === actualAway ? 5 : 0;

  return Math.min(outcomePts + exactBonus, 20);
}
