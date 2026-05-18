import { describe, expect, it } from 'vitest';
import { formatDurationShort, formatLockStatus } from './deadline';

const t = (key: string, params?: Record<string, string | number>) => {
  if (key === 'deadline.locked') return 'Locked';
  if (key === 'deadline.locksIn') return `Locks in ${params?.time}`;
  return key;
};

describe('deadline utilities', () => {
  it('formats short durations', () => {
    expect(formatDurationShort(30 * 1000)).toBe('1m');
    expect(formatDurationShort(75 * 60 * 1000)).toBe('1h 15m');
    expect(formatDurationShort(26 * 60 * 60 * 1000)).toBe('1d 2h');
  });

  it('formats lock status from a deadline', () => {
    const now = new Date('2026-06-01T10:00:00.000Z');

    expect(formatLockStatus('2026-06-01T10:12:00.000Z', now, t)).toBe('Locks in 12m');
    expect(formatLockStatus('2026-06-01T09:59:00.000Z', now, t)).toBe('Locked');
    expect(formatLockStatus(null, now, t)).toBeNull();
  });
});
