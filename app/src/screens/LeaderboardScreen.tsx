import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { fetchMyLeagues } from '../api/leagues';
import { League, LeagueMember } from '../types';
import Avatar from '../components/ui/Avatar';
import { colors, fonts } from '../theme';
import { memberAvatarUrl, memberName, memberPoints, sortMembersByPoints } from '../utils/league';

const MEMBER_COLORS = ['#494fdf', '#00a87e', '#e61e49', '#ec7e00', '#936d62'];

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

export default function LeaderboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [league, setLeague] = useState<League | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const leagues = await fetchMyLeagues();
      if (leagues.length > 0) setLeague(leagues[0]);
    } catch {
      // silently fail
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  const members: LeagueMember[] = league
    ? sortMembersByPoints(league.members)
    : [];

  const top3 = members.slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>
            {league ? `${league.name} · ${members.length} players` : 'Join a league to see rankings'}
          </Text>
        </View>

        {/* Podium */}
        {top3.length >= 3 && (
          <View style={styles.podium}>
            {/* 2nd */}
            <PodiumSlot member={top3[1]} rank={2} color={MEMBER_COLORS[1]} />
            {/* 1st */}
            <PodiumSlot member={top3[0]} rank={1} color={MEMBER_COLORS[0]} elevated />
            {/* 3rd */}
            <PodiumSlot member={top3[2]} rank={3} color={MEMBER_COLORS[2]} />
          </View>
        )}

        {/* Full list */}
        {members.length > 0 && (
          <View>
            <View style={styles.card}>
              {members.map((member, i) => {
                const memberUser = member.userId as any;
                const name = memberName(member);
                const isMe = memberUser?.id === user?.id || memberUser?._id === user?.id;
                const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                return (
                  <View
                    key={i}
                    style={[
                      styles.memberRow,
                      i < members.length - 1 && styles.memberRowBorder,
                      isMe && styles.memberRowMe,
                    ]}
                  >
                    <View style={styles.rankCell}>
                      {i < 3 ? (
                        <Text style={styles.medal}>{['🥇', '🥈', '🥉'][i]}</Text>
                      ) : (
                        <Text style={[styles.rankNum, i === 0 && { color: '#f5a623' }]}>{i + 1}</Text>
                      )}
                    </View>
                    <Avatar name={name} color={color} imageUrl={memberAvatarUrl(member)} size={34} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.memberName}>{name}</Text>
                        {isMe && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youText}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberSub}>
                        {memberPoints(member)} total points
                      </Text>
                    </View>
                    <Text style={styles.memberPts}>
                      {memberPoints(member)}
                      <Text style={styles.memberPtsSuffix}> pts</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Points key */}
        <View>
          <SectionLabel>Points System</SectionLabel>
          <View style={styles.pointsCard}>
            {[
              { label: 'Exact score', pts: '+10 pts', color: colors.accent },
              { label: 'Correct GD + winner', pts: '+6 pts', color: colors.accent },
              { label: 'Correct draw (wrong score)', pts: '+5 pts', color: colors.blue },
              { label: 'Correct winner only', pts: '+4 pts', color: colors.blue },
              { label: 'Wrong prediction', pts: '0 pts', color: colors.danger },
            ].map(({ label, pts, color }) => (
              <View key={label} style={styles.pointsRow}>
                <Text style={styles.pointsLabel}>{label}</Text>
                <Text style={[styles.pointsValue, { color }]}>{pts}</Text>
              </View>
            ))}
            <View style={styles.multiplierBox}>
              <Text style={styles.multiplierTitle}>Stage Multipliers</Text>
              <Text style={styles.multiplierText}>
                Group ×1 · R32 ×1.5 · R16 ×2 · QF ×2.5 · SF ×3 · Final ×4
              </Text>
            </View>
          </View>
        </View>

        {members.length === 0 && !refreshing && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No league data yet.</Text>
            <Text style={styles.emptySubtext}>Join or create a league to see rankings.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PodiumSlot({
  member,
  rank,
  color,
  elevated = false,
}: {
  member: LeagueMember;
  rank: number;
  color: string;
  elevated?: boolean;
}) {
  const name = memberName(member);
  const medal = ['🥇', '🥈', '🥉'][rank - 1];
  const size = elevated ? 50 : 40;

  return (
    <View style={[styles.podiumSlot, elevated && styles.podiumSlotElevated]}>
      {elevated && <Text style={styles.crown}>👑</Text>}
      <Avatar name={name} color={color} imageUrl={memberAvatarUrl(member)} size={size} />
      <Text style={[styles.podiumName, elevated && styles.podiumNameLarge]}>{name}</Text>
      <View style={[styles.podiumBadge, elevated && styles.podiumBadgeAccent]}>
        <Text style={[styles.podiumBadgeText, elevated && { color: colors.accent, fontSize: 14 }]}>
          {medal} {memberPoints(member)}pts
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 16, gap: 18 },

  titleRow: { marginTop: 4 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.dim, letterSpacing: 1.2, marginBottom: 8, fontFamily: fonts.bodyMedium,
  },

  podium: {
    backgroundColor: '#181b21',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  podiumSlot: { flex: 1, alignItems: 'center', gap: 6 },
  podiumSlotElevated: { marginBottom: 14 },
  crown: { fontSize: 18, marginBottom: 2 },
  podiumName: { color: colors.text, fontSize: 13, fontFamily: fonts.displayBold },
  podiumNameLarge: { fontSize: 15, fontFamily: fonts.displayBold },
  podiumBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  podiumBadgeAccent: { backgroundColor: colors.accentDim },
  podiumBadgeText: { color: colors.muted, fontSize: 13, fontWeight: '700' },

  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, paddingHorizontal: 14 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  memberRowMe: { backgroundColor: 'rgba(73,79,223,0.06)' },
  rankCell: { width: 26, alignItems: 'center' },
  medal: { fontSize: 16 },
  rankNum: { color: colors.dim, fontSize: 13, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: fonts.bodyMedium },
  youBadge: { backgroundColor: colors.blueDim, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8 },
  youText: { color: colors.blue, fontSize: 10 },
  memberSub: { color: colors.dim, fontSize: 10, marginTop: 1 },
  memberPts: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  memberPtsSuffix: { color: colors.muted, fontSize: 10, fontWeight: '400' },

  pointsCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, paddingHorizontal: 16 },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pointsLabel: { color: colors.muted, fontSize: 13 },
  pointsValue: { fontSize: 13, fontWeight: '700' },
  multiplierBox: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 10 },
  multiplierTitle: { color: colors.dim, fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  multiplierText: { color: colors.muted, fontSize: 12, lineHeight: 18 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4 },
});
