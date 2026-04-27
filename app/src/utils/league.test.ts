import { describe, expect, it } from 'vitest';
import {
  avatarColor,
  getMemberRank,
  isCurrentMember,
  memberId,
  memberInitials,
  memberName,
  memberPoints,
  sortMembersByPoints,
} from './league';
import { LeagueMember } from '../types';

function member(overrides: Partial<LeagueMember['userId']> = {}): LeagueMember {
  return {
    userId: {
      id: '',
      _id: '',
      name: '',
      email: '',
      avatarUrl: '',
      totalPoints: 0,
      ...overrides,
    },
    joinedAt: '2026-01-01T00:00:00.000Z',
    isAdmin: false,
  };
}

describe('league utilities', () => {
  it('normalizes member identity, display name, initials, and points', () => {
    const fullMember = member({ id: 'user-1', _id: 'legacy-id', name: 'Pablo Ibanez', totalPoints: 42 });
    const fallbackMember = member({ _id: 'legacy-id' });

    expect(memberId(fullMember)).toBe('user-1');
    expect(memberId(fallbackMember)).toBe('legacy-id');
    expect(memberName(fullMember)).toBe('Pablo Ibanez');
    expect(memberName(fallbackMember)).toBe('Player');
    expect(memberInitials(fullMember)).toBe('PI');
    expect(memberPoints(fullMember)).toBe(42);
  });

  it('detects the current member and ranks members by points', () => {
    const members = [
      member({ id: 'low', name: 'Low', totalPoints: 2 }),
      member({ id: 'high', name: 'High', totalPoints: 10 }),
      member({ id: 'middle', name: 'Middle', totalPoints: 6 }),
    ];

    expect(isCurrentMember(members[1], 'high')).toBe(true);
    expect(isCurrentMember(members[1])).toBe(false);
    expect(sortMembersByPoints(members).map(memberId)).toEqual(['high', 'middle', 'low']);
    expect(getMemberRank(members, 'middle')).toBe(2);
    expect(getMemberRank(members, 'missing')).toBeNull();
  });

  it('returns stable avatar colors from member ids', () => {
    expect(avatarColor('user-1')).toBe(avatarColor('user-1'));
    expect(avatarColor('user-1')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
