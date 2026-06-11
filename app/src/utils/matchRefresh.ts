import type { Match } from '../types';

export const LIVE_MATCH_REFRESH_MS = 60 * 1000;
export const PRE_KICKOFF_REFRESH_WINDOW_MS = 30 * 60 * 1000;
export const POST_KICKOFF_REFRESH_WINDOW_MS = 2.5 * 60 * 60 * 1000;

type RefreshableMatch = Pick<Match, 'status' | 'utcDate'>;

function parseKickoff(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getMatchRefreshDelay(matches: RefreshableMatch[], now = Date.now()): number | null {
  if (matches.some((match) => match.status === 'LIVE')) {
    return LIVE_MATCH_REFRESH_MS;
  }

  const pollingStartTimes = matches
    .filter((match) => match.status === 'SCHEDULED')
    .map((match) => parseKickoff(match.utcDate))
    .filter((kickoff): kickoff is number => kickoff != null)
    .map((kickoff) => ({
      kickoff,
      pollingStartsAt: kickoff - PRE_KICKOFF_REFRESH_WINDOW_MS,
      pollingEndsAt: kickoff + POST_KICKOFF_REFRESH_WINDOW_MS,
    }))
    .filter(({ pollingEndsAt }) => pollingEndsAt >= now)
    .sort((a, b) => a.pollingStartsAt - b.pollingStartsAt);

  const nextWindow = pollingStartTimes[0];
  if (!nextWindow) return null;

  if (now >= nextWindow.pollingStartsAt) {
    return LIVE_MATCH_REFRESH_MS;
  }

  return nextWindow.pollingStartsAt - now;
}
