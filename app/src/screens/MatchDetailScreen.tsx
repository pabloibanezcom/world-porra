import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { fetchMatch } from '../api/matches';
import { submitPrediction } from '../api/predictions';
import { Match, Prediction } from '../types';
import { colors, spacing, fontSize, borderRadius, fonts } from '../theme';
import { format } from 'date-fns';
import { hasTbdTeam } from '../components/MatchCard';
import { useI18n } from '../i18n';
import { isPredictionLocked } from '../utils/prediction';

type RouteParams = { MatchDetail: { matchId: string } };

const LIVE_SCORE_REFRESH_MS = 60 * 1000;

export default function MatchDetailScreen() {
  const { language, t } = useI18n();
  const route = useRoute<RouteProp<RouteParams, 'MatchDetail'>>();
  const [match, setMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadMatch();
  }, [route.params.matchId, language]);

  useEffect(() => {
    if (match?.status !== 'LIVE') return;

    const interval = setInterval(() => {
      loadMatch();
    }, LIVE_SCORE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [match?.status, route.params.matchId, language]);

  const loadMatch = async () => {
    try {
      const data = await fetchMatch(route.params.matchId);
      setMatch(data.match);
      setPrediction(data.prediction);
      if (data.prediction) {
        setHomeGoals(data.prediction.homeGoals);
        setAwayGoals(data.prediction.awayGoals);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!match) return;
    if (hasTbdTeam(match)) {
      Alert.alert(t('match.predictionsTbd'));
      return;
    }

    setSubmitting(true);
    try {
      const pred = await submitPrediction(match._id, homeGoals, awayGoals);
      setPrediction(pred);
      Alert.alert(t('match.saved'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('match.failedSave'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = match ? isPredictionLocked(match) : false;
  const teamsTbd = match ? hasTbdTeam(match) : false;
  const predictionDisabled = isLocked || teamsTbd;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Text>{t('match.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.matchHeader}>
        <Text style={styles.stage}>
          {match.stage.replace(/_/g, ' ')}{match.group ? ` - ${t('common.group', { group: match.group })}` : ''}
        </Text>
        <Text style={styles.date}>{format(new Date(match.utcDate), 'EEE, MMM d · HH:mm')}</Text>
      </View>

      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamCode}>{match.homeTeam.code}</Text>
          <Text style={styles.teamName}>{match.homeTeam.name}</Text>
        </View>
        <Text style={styles.vs}>
          {match.result ? `${match.result.homeGoals} - ${match.result.awayGoals}` : t('common.vs')}
        </Text>
        <View style={styles.team}>
          <Text style={styles.teamCode}>{match.awayTeam.code}</Text>
          <Text style={styles.teamName}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {match.odds && match.status !== 'FINISHED' && (
        <View style={styles.oddsSection}>
          <Text style={styles.oddsSectionTitle}>{t('match.bettingOdds')}</Text>
          <View style={styles.oddsColumns}>
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>{match.homeTeam.code}</Text>
              <Text style={styles.oddsNum}>{match.odds.home?.toFixed(2)}</Text>
            </View>
            <View style={styles.oddsColDivider} />
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>X</Text>
              <Text style={styles.oddsNum}>{match.odds.draw?.toFixed(2)}</Text>
            </View>
            <View style={styles.oddsColDivider} />
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>{match.awayTeam.code}</Text>
              <Text style={styles.oddsNum}>{match.odds.away?.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Prediction section */}
      <View style={styles.predictionSection}>
        <Text style={styles.sectionTitle}>
          {predictionDisabled ? t('match.yourPrediction') : t('match.makePrediction')}
        </Text>

        {prediction?.points != null && (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>+{prediction.points} {t('common.pointsShort')}</Text>
          </View>
        )}

        <View style={styles.scoreInput}>
          <View style={styles.scoreColumn}>
            <Text style={styles.scoreLabel}>{match.homeTeam.code}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setHomeGoals(Math.max(0, homeGoals - 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.scoreValue}>{homeGoals}</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setHomeGoals(Math.min(15, homeGoals + 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.scoreDash}>–</Text>

          <View style={styles.scoreColumn}>
            <Text style={styles.scoreLabel}>{match.awayTeam.code}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setAwayGoals(Math.max(0, awayGoals - 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.scoreValue}>{awayGoals}</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setAwayGoals(Math.min(15, awayGoals + 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!predictionDisabled && (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{prediction ? t('match.updatePrediction') : t('match.submitPrediction')}</Text>
            )}
          </TouchableOpacity>
        )}

        {predictionDisabled && !prediction && (
          <Text style={styles.lockedText}>
            {teamsTbd ? t('match.predictionsTbd') : t('match.locked')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  matchHeader: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.primary },
  stage: { color: colors.accent, fontSize: fontSize.sm, fontWeight: '600', textTransform: 'uppercase' },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm, marginTop: spacing.xs },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.surface },
  team: { flex: 1, alignItems: 'center' },
  teamCode: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  teamName: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  vs: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textSecondary, marginHorizontal: spacing.md },
  predictionSection: { padding: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  pointsBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, alignSelf: 'flex-start', marginBottom: spacing.md },
  pointsText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  scoreInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  scoreColumn: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  stepButton: { padding: spacing.md, width: 48, alignItems: 'center' },
  stepText: { fontSize: fontSize.xl, color: colors.primary, fontWeight: '600' },
  scoreValue: { fontSize: fontSize.xxl, fontWeight: '800', paddingHorizontal: spacing.md, minWidth: 48, textAlign: 'center' },
  scoreDash: { fontSize: fontSize.xl, color: colors.textLight, marginHorizontal: spacing.sm },
  submitButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
  lockedText: { color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
  oddsSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  oddsSectionTitle: {
    color: colors.muted,
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  oddsColumns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddsCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  oddsColDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  oddsTeam: {
    color: colors.muted,
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
  },
  oddsNum: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
  },
});
