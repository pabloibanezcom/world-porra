import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { League } from '../types';
import { colors, fonts } from '../theme';

const AVATAR_COLORS = ['#494fdf', '#00a87e', '#e23b4a', '#ec7e00', '#936d62', '#9b59b6', '#1abc9c'];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

interface Props {
  league: League;
  userId?: string;
  compact?: boolean;
  onPress?: () => void;
}

const AV = 28;
const AV_ME = 32;

export default function LeagueCard({ league, userId, compact = false, onPress }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);

  const memberPts = (m: typeof league.members[0]) => m.userId.totalPoints ?? 0;
  const sorted = [...league.members].sort((a, b) => memberPts(b) - memberPts(a));
  const myIndex = sorted.findIndex((m) => m.userId.id === userId || (m.userId as any)._id === userId);
  const rank = myIndex >= 0 ? myIndex + 1 : null;
  const myPoints = myIndex >= 0 ? memberPts(sorted[myIndex]) : null;

  const isLeading = rank === 1;
  const accent = isLeading ? colors.accent : colors.blue;
  const accentDim = isLeading ? colors.accentDim : colors.blueDim;

  const allPts = league.members.map(memberPts);
  const maxPts = Math.max(...allPts);
  const minPts = Math.min(...allPts);
  const range = maxPts - minPts || 1;

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  // Sort ascending so higher-scorers render on top
  const trackMembers = [...league.members].sort((a, b) => a.totalPoints - b.totalPoints);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      {/* Top row */}
      <View style={[styles.topRow, compact && { marginBottom: 0 }]}>
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>{league.name}</Text>
          <Text style={styles.sub}>
            {league.members.length} players{myPoints !== null ? ` · ${myPoints} pts` : ''}
          </Text>
        </View>
        {rank !== null && (
          <View style={[styles.rankBadge, { backgroundColor: accentDim }]}>
            <Text style={[styles.rankNum, { color: accent }]}>#{rank}</Text>
            <Text style={[styles.rankLabel, { color: accent }]}>rank</Text>
          </View>
        )}
      </View>

      {/* Avatar race track */}
      {!compact && <View style={styles.track} onLayout={onTrackLayout}>
        <View style={[styles.trackLine, { top: AV_ME / 2, backgroundColor: `${accent}66` }]} />
        {trackWidth > 0 && trackMembers.map((member, j) => {
          const u = member.userId as any;
          const isMe = member.userId.id === userId || (member.userId as any)._id === userId;
          const avSize = isMe ? AV_ME : AV;
          const pts = memberPts(member);
          const pct = (pts - minPts) / range;
          const leftPos = Math.min(pct * (trackWidth - AV), trackWidth - avSize);
          const color = avatarColor(member.userId.id || (member.userId as any)._id || String(j));
          const label = member.userId.name ? initials(member.userId.name) : '?';

          return (
            <View
              key={u?.id || u?._id || j}
              style={[styles.avatarWrap, { left: leftPos, zIndex: isMe ? 10 : j }]}
            >
              <View style={[
                styles.avatar,
                {
                  width: avSize,
                  height: avSize,
                  borderRadius: avSize / 2,
                  backgroundColor: color,
                  borderWidth: isMe ? 2 : 1.5,
                  borderColor: isMe ? accent : colors.bg,
                },
                isMe && styles.avatarMe,
              ]}>
                <Text style={[styles.avatarText, { fontSize: isMe ? 11 : 9 }]}>{label}</Text>
              </View>
              <Text style={[styles.pts, { color: isMe ? accent : colors.dim, fontWeight: isMe ? '700' : '400' }]}>
                {pts}
              </Text>
            </View>
          );
        })}
      </View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingHorizontal: 18,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  nameBlock: { flex: 1, marginRight: 12 },
  name: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
  },
  sub: {
    color: colors.dim,
    fontSize: 11,
    fontFamily: fonts.body,
    marginTop: 3,
  },
  rankBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 52,
  },
  rankNum: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    lineHeight: 22,
  },
  rankLabel: {
    fontSize: 9,
    fontFamily: fonts.body,
    marginTop: 2,
    opacity: 0.8,
  },

  track: {
    position: 'relative',
    height: AV_ME + 20,
    marginTop: 8,
  },
  trackLine: {
    position: 'absolute',
    left: AV_ME / 2,
    right: AV_ME / 2,
    height: 2,
    borderRadius: 1,
  },
  avatarWrap: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: {
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
  pts: {
    fontSize: 8,
    fontFamily: fonts.body,
    marginTop: 3,
  },
});
