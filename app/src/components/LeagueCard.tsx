import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { League } from '../types';
import { colors, fonts } from '../theme';
import LeagueRaceStrip from './LeagueRaceStrip';
import { getMemberRank, isCurrentMember, memberPoints, sortMembersByPoints } from '../utils/league';
import { useI18n } from '../i18n';

interface Props {
  league: League;
  userId?: string;
  compact?: boolean;
  onPress?: () => void;
}

export default function LeagueCard({ league, userId, compact = false, onPress }: Props) {
  const { t } = useI18n();
  const sorted = sortMembersByPoints(league.members);
  const rank = getMemberRank(league.members, userId);
  const me = sorted.find((member) => isCurrentMember(member, userId));
  const myPoints = me ? memberPoints(me) : null;

  const accent = colors.accent;
  const accentDim = colors.accentDim;

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
            {myPoints !== null
              ? t('leagues.playersWithPoints', { count: league.members.length, points: myPoints })
              : t('leagues.players', { count: league.members.length })}
          </Text>
        </View>
        {rank !== null && (
          <View style={[styles.rankBadge, { backgroundColor: accentDim }]}>
            <Text style={[styles.rankNum, { color: accent }]}>#{rank}</Text>
            <Text style={[styles.rankLabel, { color: accent }]}>{t('common.rank')}</Text>
          </View>
        )}
      </View>

      {/* Avatar race track */}
      {!compact && <LeagueRaceStrip members={league.members} userId={userId} accent={accent} accentDim={accentDim} />}
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
});
