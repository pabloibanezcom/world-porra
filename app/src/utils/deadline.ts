type Translate = (key: string, params?: Record<string, string | number>) => string;

export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${Math.max(1, minutes)}m`;
}

export function formatLockStatus(deadline: string | Date | null | undefined, now: Date, t: Translate): string | null {
  if (!deadline) return null;

  const lockTime = deadline instanceof Date ? deadline : new Date(deadline);
  const diff = lockTime.getTime() - now.getTime();

  if (Number.isNaN(lockTime.getTime())) return null;
  if (diff <= 0) return t('deadline.locked');

  return t('deadline.locksIn', { time: formatDurationShort(diff) });
}
