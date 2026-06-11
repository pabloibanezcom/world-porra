import { describe, expect, it } from 'vitest';
import {
  getMatchRefreshDelay,
  LIVE_MATCH_REFRESH_MS,
  PRE_KICKOFF_REFRESH_WINDOW_MS,
} from './matchRefresh';

describe('match refresh scheduling', () => {
  const now = Date.parse('2026-06-11T17:00:00.000Z');

  it('refreshes every minute while a match is live', () => {
    expect(getMatchRefreshDelay([{ status: 'LIVE', utcDate: '2026-06-11T20:00:00.000Z' }], now)).toBe(
      LIVE_MATCH_REFRESH_MS,
    );
  });

  it('waits until the pre-kickoff window before polling scheduled matches', () => {
    const kickoff = '2026-06-11T20:00:00.000Z';

    expect(getMatchRefreshDelay([{ status: 'SCHEDULED', utcDate: kickoff }], now)).toBe(
      Date.parse(kickoff) - PRE_KICKOFF_REFRESH_WINDOW_MS - now,
    );
  });

  it('polls every minute inside the pre-kickoff and early in-match window', () => {
    expect(
      getMatchRefreshDelay(
        [{ status: 'SCHEDULED', utcDate: '2026-06-11T17:20:00.000Z' }],
        now,
      ),
    ).toBe(LIVE_MATCH_REFRESH_MS);

    expect(
      getMatchRefreshDelay(
        [{ status: 'SCHEDULED', utcDate: '2026-06-11T16:30:00.000Z' }],
        now,
      ),
    ).toBe(LIVE_MATCH_REFRESH_MS);
  });

  it('does not schedule refreshes for finished matches', () => {
    expect(getMatchRefreshDelay([{ status: 'FINISHED', utcDate: '2026-06-11T16:00:00.000Z' }], now)).toBeNull();
  });
});
