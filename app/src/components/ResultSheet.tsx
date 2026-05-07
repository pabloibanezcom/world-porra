import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import Flag from './ui/Flag';
import { Match, Prediction, MatchStage } from '../types';
import { getTeamLabel, isKnockoutStage } from './MatchCard';
import { useI18n } from '../i18n';

const KNOCKOUT_MULTIPLIERS: Record<MatchStage, number> = {
  GROUP: 0, ROUND_OF_32: 2, ROUND_OF_16: 3,
  QUARTER_FINAL: 4, SEMI_FINAL: 5, THIRD_PLACE: 4, FINAL: 6,
};

const KNOCKOUT_EXACT_BONUS: Record<MatchStage, number> = {
  GROUP: 0, ROUND_OF_32: 6, ROUND_OF_16: 8,
  QUARTER_FINAL: 10, SEMI_FINAL: 12, THIRD_PLACE: 10, FINAL: 15,
};

interface Breakdown {
  outcomeCorrect: boolean;
  outcomePts: number;
  isExact: boolean;
  exactBonus: number;
  qualifierCorrect: boolean;
  advancingPts: number;
  total: number;
}

function calcBreakdown(match: Match, prediction: Prediction): Breakdown {
  const result = match.result!;
  const knockout = isKnockoutStage(match.stage);

  const isExact =
    prediction.homeGoals === result.homeGoals &&
    prediction.awayGoals === result.awayGoals;

  if (knockout) {
    const qualifierCorrect = !!prediction.qualifier && prediction.qualifier === result.winner;
    let advancingPts = 0;
    if (qualifierCorrect && match.odds) {
      const advOdds = prediction.qualifier === 'HOME' ? match.odds.home : match.odds.away;
      if (advOdds && advOdds > 0) {
        advancingPts = Math.round(advOdds * KNOCKOUT_MULTIPLIERS[match.stage]);
      }
    }
    const exactBonus = isExact ? KNOCKOUT_EXACT_BONUS[match.stage] : 0;
    return {
      outcomeCorrect: false,
      outcomePts: 0,
      isExact,
      exactBonus,
      qualifierCorrect,
      advancingPts,
      total: advancingPts + exactBonus,
    };
  }

  const predOutcome = prediction.homeGoals > prediction.awayGoals ? 'HOME'
    : prediction.homeGoals < prediction.awayGoals ? 'AWAY' : 'DRAW';
  const outcomeCorrect = predOutcome === result.winner;

  let outcomePts = 0;
  if (outcomeCorrect) {
    let chosenOdds: number | null = null;
    if (match.odds) {
      if (predOutcome === 'HOME') chosenOdds = match.odds.home;
      else if (predOutcome === 'AWAY') chosenOdds = match.odds.away;
      else chosenOdds = match.odds.draw;
    }
    outcomePts = chosenOdds && chosenOdds > 0 ? Math.round(chosenOdds * 2) : 2;
  }
  const exactBonus = isExact ? 5 : 0;

  return {
    outcomeCorrect,
    outcomePts,
    isExact,
    exactBonus,
    qualifierCorrect: false,
    advancingPts: 0,
    total: Math.min(outcomePts + exactBonus, 20),
  };
}

interface Props {
  match: Match | null;
  prediction?: Prediction | null;
  onClose: () => void;
}

export default function ResultSheet({ match, prediction, onClose }: Props) {
  const { t, locale } = useI18n();
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (match) {
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [match]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!match || !match.result) return null;

  const knockout = isKnockoutStage(match.stage);
  const homeCode = getTeamLabel(match.homeTeam.name, match.homeTeam.code);
  const awayCode = getTeamLabel(match.awayTeam.name, match.awayTeam.code);
  const result = match.result;

  const groupLabel = match.group ? t('common.group', { group: match.group }) : match.stage;
  const dateStr = new Date(match.utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  const breakdown = prediction ? calcBreakdown(match, prediction) : null;
  const totalPts = prediction?.points ?? breakdown?.total ?? 0;

  return (
    <Modal transparent visible={!!match} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {/* Actual result */}
        <View style={styles.matchHeader}>
          <View style={styles.matchTeams}>
            <Flag code={match.homeTeam.code} size={24} />
            <Text style={styles.teamCode}>{homeCode}</Text>
            <Text style={styles.resultScore}>
              {result.homeGoals} – {result.awayGoals}
            </Text>
            <Text style={styles.teamCode}>{awayCode}</Text>
            <Flag code={match.awayTeam.code} size={24} />
          </View>
          <Text style={styles.meta}>{groupLabel} · {dateStr}</Text>
        </View>

        {/* Your prediction */}
        {prediction ? (
          <View style={styles.predictionRow}>
            <Text style={styles.sectionLabel}>{t('resultSheet.yourPick')}</Text>
            <View style={styles.predictionScoreRow}>
              <Flag code={match.homeTeam.code} size={16} />
              <Text style={styles.predictionScore}>
                {prediction.homeGoals} – {prediction.awayGoals}
              </Text>
              <Flag code={match.awayTeam.code} size={16} />
              {knockout && prediction.qualifier && (
                <Text style={styles.qualifierLabel}>
                  · {prediction.qualifier === 'HOME' ? homeCode : awayCode} {t('resultSheet.advances')}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.predictionRow}>
            <Text style={styles.noPrediction}>{t('resultSheet.noPick')}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Points breakdown */}
        {breakdown ? (
          <View style={styles.breakdown}>
            <Text style={styles.sectionLabel}>{t('resultSheet.breakdown')}</Text>

            {knockout ? (
              <>
                <BreakdownRow
                  earned={breakdown.qualifierCorrect}
                  label={breakdown.qualifierCorrect
                    ? t('resultSheet.advancesCorrect', {
                        code: prediction!.qualifier === 'HOME' ? homeCode : awayCode,
                      })
                    : t('resultSheet.advancesWrong')}
                  pts={breakdown.advancingPts}
                />
                <BreakdownRow
                  earned={breakdown.isExact}
                  label={t('resultSheet.exactScore')}
                  pts={KNOCKOUT_EXACT_BONUS[match.stage]}
                />
              </>
            ) : (
              <>
                <BreakdownRow
                  earned={breakdown.outcomeCorrect}
                  label={breakdown.outcomeCorrect
                    ? t('resultSheet.correctOutcome')
                    : t('resultSheet.wrongOutcome')}
                  pts={breakdown.outcomePts}
                />
                {breakdown.outcomeCorrect && (
                  <BreakdownRow
                    earned={breakdown.isExact}
                    label={t('resultSheet.exactScore')}
                    pts={5}
                  />
                )}
              </>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('resultSheet.total')}</Text>
              <Text style={[styles.totalPts, totalPts > 0 && styles.totalPtsEarned]}>
                {totalPts} {t('common.pointsShort')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.breakdown}>
            <Text style={styles.noPrediction}>{t('resultSheet.zeroPts')}</Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

function BreakdownRow({ earned, label, pts }: { earned: boolean; label: string; pts: number }) {
  return (
    <View style={styles.breakdownRow}>
      <Ionicons
        name={earned ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={earned ? colors.accent : colors.dim}
        style={styles.breakdownIcon}
      />
      <Text style={[styles.breakdownLabel, !earned && styles.missed]}>{label}</Text>
      <Text style={[styles.breakdownPts, earned ? styles.earned : styles.missed]}>
        {earned ? `+${pts}` : '–'} {earned ? 'pts' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    paddingBottom: 44,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  matchHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  teamCode: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  resultScore: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: fonts.display,
    marginHorizontal: 4,
  },
  meta: {
    color: colors.dim,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  predictionRow: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  sectionLabel: {
    color: colors.dim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.bodyMedium,
    marginBottom: 6,
  },
  predictionScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  predictionScore: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.display,
  },
  qualifierLabel: {
    color: colors.dim,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  noPrediction: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  breakdown: {
    gap: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
  },
  breakdownIcon: {
    width: 16,
  },
  breakdownLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  breakdownPts: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  earned: {
    color: colors.accent,
  },
  missed: {
    color: colors.muted,
    opacity: 0.6,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.display,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalPts: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.display,
    color: colors.muted,
  },
  totalPtsEarned: {
    color: colors.accent,
  },
});
