import { describe, it, expect } from 'vitest';
import { calculatePoints, ScoreInput } from '../src/services/scoring';

function score(predicted: [number, number], actual: [number, number], stage = 'GROUP' as const): number {
  return calculatePoints({
    predictedHome: predicted[0],
    predictedAway: predicted[1],
    actualHome: actual[0],
    actualAway: actual[1],
    stage,
  });
}

describe('calculatePoints', () => {
  describe('Group stage (x1)', () => {
    it('exact score → 10 points', () => {
      expect(score([2, 1], [2, 1])).toBe(10);
      expect(score([0, 0], [0, 0])).toBe(10);
      expect(score([3, 3], [3, 3])).toBe(10);
    });

    it('correct goal difference + winner → 6 points', () => {
      expect(score([3, 2], [2, 1])).toBe(6);
      expect(score([1, 3], [0, 2])).toBe(6);
    });

    it('correct draw, wrong score → 5 points', () => {
      expect(score([0, 0], [1, 1])).toBe(5);
      expect(score([2, 2], [0, 0])).toBe(5);
    });

    it('correct winner only → 4 points', () => {
      expect(score([2, 0], [1, 0])).toBe(4); // diff +2 vs +1
      expect(score([3, 0], [1, 0])).toBe(4); // diff +3 vs +1
      expect(score([0, 1], [0, 3])).toBe(4); // diff -1 vs -3
    });

    it('wrong prediction → 0 points', () => {
      expect(score([2, 0], [0, 1])).toBe(0);
      expect(score([0, 0], [1, 0])).toBe(0);
      expect(score([1, 0], [0, 0])).toBe(0);
    });
  });

  describe('Stage multipliers', () => {
    it('Round of 32 → x1.5', () => {
      expect(score([2, 1], [2, 1], 'ROUND_OF_32')).toBe(15);
      expect(score([2, 0], [1, 0], 'ROUND_OF_32')).toBe(6);
    });

    it('Round of 16 → x2', () => {
      expect(score([2, 1], [2, 1], 'ROUND_OF_16')).toBe(20);
    });

    it('Quarter-final → x2.5', () => {
      expect(score([2, 1], [2, 1], 'QUARTER_FINAL')).toBe(25);
    });

    it('Semi-final → x3', () => {
      expect(score([2, 1], [2, 1], 'SEMI_FINAL')).toBe(30);
      expect(score([2, 0], [1, 0], 'SEMI_FINAL')).toBe(12);
    });

    it('Final → x4', () => {
      expect(score([2, 1], [2, 1], 'FINAL')).toBe(40);
      expect(score([0, 0], [1, 1], 'FINAL')).toBe(20);
    });

    it('Third place → x4', () => {
      expect(score([2, 1], [2, 1], 'THIRD_PLACE')).toBe(40);
    });
  });
});
