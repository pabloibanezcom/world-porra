import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Match } from '../types';
import { colors, spacing, fontSize, borderRadius } from '../theme';

interface Props {
  match: Match;
  onPress?: () => void;
}

export default function MatchCard({ match, onPress }: Props) {
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress}>
      <View style={styles.meta}>
        <Text style={styles.stage}>
          {match.stage.replace(/_/g, ' ')}
          {match.group ? ` · Group ${match.group}` : ''}
        </Text>
        {isLive && <Text style={styles.live}>LIVE</Text>}
      </View>

      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamCode}>{match.homeTeam.code}</Text>
          <Text style={styles.teamName} numberOfLines={1}>{match.homeTeam.name}</Text>
        </View>

        <View style={styles.scoreContainer}>
          {isFinished || isLive ? (
            <Text style={styles.score}>
              {match.result?.homeGoals ?? '?'} - {match.result?.awayGoals ?? '?'}
            </Text>
          ) : (
            <Text style={styles.time}>{format(new Date(match.utcDate), 'HH:mm')}</Text>
          )}
        </View>

        <View style={[styles.team, styles.teamRight]}>
          <Text style={styles.teamCode}>{match.awayTeam.code}</Text>
          <Text style={styles.teamName} numberOfLines={1}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {!isFinished && !isLive && (
        <Text style={styles.date}>{format(new Date(match.utcDate), 'EEE, MMM d')}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stage: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  live: {
    fontSize: fontSize.xs,
    color: colors.error,
    fontWeight: '800',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  team: { flex: 1 },
  teamRight: { alignItems: 'flex-end' },
  teamCode: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  teamName: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  scoreContainer: { paddingHorizontal: spacing.md },
  score: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  time: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  date: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
