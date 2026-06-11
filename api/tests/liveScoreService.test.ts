import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
    })),
  },
}));

let applyLiveScores: typeof import('../src/services/liveScoreService').applyLiveScores;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-with-enough-length';
  process.env.LIVE_SCORE_CACHE_SECONDS = '60';
  ({ applyLiveScores } = await import('../src/services/liveScoreService'));
});

beforeEach(() => {
  mockGet.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-11T19:10:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('applyLiveScores', () => {
  it('overlays a live score onto a recently kicked off scheduled match', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        events: [
          {
            competitions: [
              {
                status: { type: { state: 'in' } },
                competitors: [
                  { homeAway: 'home', score: '1', team: { abbreviation: 'USA' } },
                  { homeAway: 'away', score: '0', team: { abbreviation: 'CAN' } },
                ],
              },
            ],
          },
        ],
      },
    });

    const [match] = await applyLiveScores([
      {
        utcDate: '2026-06-11T19:00:00.000Z',
        status: 'SCHEDULED' as const,
        homeTeamCode: 'USA',
        awayTeamCode: 'CAN',
        result: null,
      },
    ]);

    expect(mockGet).toHaveBeenCalledWith('', { params: { dates: '20260611' } });
    expect(match.status).toBe('LIVE');
    expect(match.result).toEqual({ homeGoals: 1, awayGoals: 0, winner: 'HOME' });
  });

  it('does not request live scores for future scheduled matches', async () => {
    const [match] = await applyLiveScores([
      {
        utcDate: '2026-06-11T20:00:00.000Z',
        status: 'SCHEDULED' as const,
        homeTeamCode: 'USA',
        awayTeamCode: 'CAN',
        result: null,
      },
    ]);

    expect(mockGet).not.toHaveBeenCalled();
    expect(match.status).toBe('SCHEDULED');
    expect(match.result).toBeNull();
  });
});
