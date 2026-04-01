import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { fetchLeague } from '../api/leagues';
import { League } from '../types';
import { colors, spacing, fontSize, borderRadius } from '../theme';

type RouteParams = { LeagueDetail: { leagueId: string } };

export default function LeagueDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'LeagueDetail'>>();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeague();
  }, []);

  const loadLeague = async () => {
    try {
      const data = await fetchLeague(route.params.leagueId);
      setLeague(data);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!league) return;
    await Share.share({
      message: `Join my WC 2026 prediction league "${league.name}"! Use invite code: ${league.inviteCode}`,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={styles.center}>
        <Text>League not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.leagueName}>{league.name}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.inviteCode}>{league.inviteCode}</Text>
          <Text style={styles.shareText}>Tap to share</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Leaderboard</Text>

      <FlatList
        data={league.members}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{(item.userId as any).name || 'Player'}</Text>
            </View>
            <Text style={styles.points}>{item.totalPoints} pts</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: spacing.lg, backgroundColor: colors.primary, alignItems: 'center' },
  leagueName: { fontSize: fontSize.xl, fontWeight: '800', color: '#fff' },
  shareButton: { marginTop: spacing.md, alignItems: 'center' },
  inviteCode: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 4,
  },
  shareText: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: spacing.xs },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  list: { paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  rank: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary, width: 36, textAlign: 'center' },
  memberInfo: { flex: 1, marginLeft: spacing.sm },
  memberName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  points: { fontSize: fontSize.md, fontWeight: '700', color: colors.accent },
});
