import { LeagueMember } from '../types';

export const LEAGUE_AVATAR_COLORS = ['#494fdf', '#00a87e', '#e61e49', '#ec7e00', '#936d62', '#9b59b6', '#1abc9c'];

export function memberId(member: LeagueMember): string {
  return member.userId.id || member.userId._id || '';
}

export function memberPoints(member: LeagueMember): number {
  return member.userId.totalPoints ?? 0;
}

export function memberName(member: LeagueMember): string {
  return member.userId.name || 'Player';
}

export function memberAvatarUrl(member: LeagueMember): string {
  return member.userId.avatarUrl || '';
}

export function memberInitials(member: LeagueMember): string {
  return memberName(member)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function isCurrentMember(member: LeagueMember, userId?: string): boolean {
  return !!userId && memberId(member) === userId;
}

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return LEAGUE_AVATAR_COLORS[Math.abs(hash) % LEAGUE_AVATAR_COLORS.length];
}

export function sortMembersByPoints(members: LeagueMember[]): LeagueMember[] {
  return [...members].sort((a, b) => memberPoints(b) - memberPoints(a));
}

export function getMemberRank(members: LeagueMember[], userId?: string): number | null {
  const sorted = sortMembersByPoints(members);
  const index = sorted.findIndex((member) => isCurrentMember(member, userId));
  return index >= 0 ? index + 1 : null;
}
