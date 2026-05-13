import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, borderRadius } from '../theme';
import Flag from './ui/Flag';
import { Match, MatchStage } from '../types';
import {
  hasTbdTeam,
  KnockoutOddsBar,
  OddsBar,
  knockoutOddsToPercents,
  oddsToPercents,
  getTeamLabel,
  isKnockoutStage,
} from './MatchCard';
import { useI18n } from '../i18n';

const KNOCKOUT_ROUND_MULTIPLIERS: Record<MatchStage, number> = {
  GROUP: 0,
  ROUND_OF_32: 2,
  ROUND_OF_16: 3,
  QUARTER_FINAL: 4,
  SEMI_FINAL: 5,
  THIRD_PLACE: 4,
  FINAL: 6,
};

const KNOCKOUT_EXACT_BONUS: Record<MatchStage, number> = {
  GROUP: 0,
  ROUND_OF_32: 6,
  ROUND_OF_16: 8,
  QUARTER_FINAL: 10,
  SEMI_FINAL: 12,
  THIRD_PLACE: 10,
  FINAL: 15,
};

interface PredictionSheetProps {
  match: Match | null;
  existing?: { score: [number, number]; qualifier?: 'HOME' | 'AWAY' | null };
  onSave: (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => Promise<void>;
  onClose: () => void;
}

function rarityMultiplier(prob: number): number {
  return parseFloat(Math.max(1, Math.min(3, 50 / prob)).toFixed(1));
}

function ScoreControl({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <View style={styles.scoreCol}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.stepper}
        onPress={() => onChange(Math.min(value + 1, 20))}
      >
        <Text style={styles.stepperIcon}>+</Text>
      </TouchableOpacity>
      <Text style={styles.scoreValue}>{value}</Text>
      <TouchableOpacity
        style={styles.stepper}
        onPress={() => onChange(Math.max(value - 1, 0))}
      >
        <Text style={[styles.stepperIcon, { color: colors.dim }]}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PredictionSheet({ match, existing, onSave, onClose }: PredictionSheetProps) {
  const { t, locale } = useI18n();
  const [score, setScore] = useState<[number, number]>(existing?.score || [0, 0]);
  const [qualifier, setQualifier] = useState<'HOME' | 'AWAY' | null>(existing?.qualifier ?? null);
  const [saving, setSaving] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const knockout = match ? isKnockoutStage(match.stage) : false;

  // Auto-set qualifier when score changes (only for non-draw in knockout)
  useEffect(() => {
    if (!knockout) return;
    if (score[0] > score[1]) setQualifier('HOME');
    else if (score[0] < score[1]) setQualifier('AWAY');
    // For draws: leave whatever qualifier was set (user picks)
  }, [score, knockout]);

  useEffect(() => {
    if (match) {
      setSaving(false);
      const initScore = existing?.score || [0, 0];
      setScore(initScore);
      if (knockout) {
        const initQualifier = existing?.qualifier ?? null;
        if (initScore[0] > initScore[1]) setQualifier('HOME');
        else if (initScore[0] < initScore[1]) setQualifier('AWAY');
        else setQualifier(initQualifier);
      } else {
        setQualifier(null);
      }
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

  const save = async () => {
    if (!match || saving) return;
    if (hasTbdTeam(match)) return;
    if (knockout && !qualifier) return;
    setSaving(true);
    try {
      await onSave(match._id, score, knockout ? qualifier : null);
      close();
    } catch {
      setSaving(false);
    }
  };

  if (!match) return null;

  const groupLabel = match.group ? t('common.group', { group: match.group }) : match.stage;
  const dateStr = new Date(match.utcDate).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = new Date(match.utcDate).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const homeCode = getTeamLabel(match.homeTeam.name, match.homeTeam.code);
  const awayCode = getTeamLabel(match.awayTeam.name, match.awayTeam.code);

  const isDraw = score[0] === score[1];
  const canSave = !knockout || !!qualifier;

  // ── Group stage points preview ──
  const groupPct = !knockout && match.odds
    ? oddsToPercents(match.odds.home, match.odds.draw, match.odds.away)
    : null;

  const predOutcome = score[0] > score[1] ? 'h' : score[0] < score[1] ? 'a' : 'd';
  const outcomeProb = groupPct
    ? (predOutcome === 'h' ? groupPct.h : predOutcome === 'a' ? groupPct.a : groupPct.d)
    : 50;
  const exactProbGroup = Math.max(outcomeProb / 8, 2);
  const exactPtsGroup = parseFloat((3 * rarityMultiplier(exactProbGroup)).toFixed(1));
  const outcomePtsGroup = parseFloat((1 * rarityMultiplier(outcomeProb)).toFixed(1));

  const groupOutcomeLabel =
    predOutcome === 'h'
      ? t('predictionSheet.teamWins', { code: homeCode })
      : predOutcome === 'a'
      ? t('predictionSheet.teamWins', { code: awayCode })
      : t('predictionSheet.draw');

  // ── Knockout points preview ──
  const knockoutPct = knockout && match.odds
    ? knockoutOddsToPercents(match.odds.home, match.odds.away)
    : null;

  let advancingPts = 0;
  if (knockout && qualifier && knockoutPct && match.odds) {
    const advOdds = qualifier === 'HOME' ? match.odds.home : match.odds.away;
    if (advOdds && advOdds > 0) {
      advancingPts = Math.round(advOdds * KNOCKOUT_ROUND_MULTIPLIERS[match.stage]);
    }
  }
  const exactBonusKnockout = KNOCKOUT_EXACT_BONUS[match.stage];

  const qualifierLabel = qualifier
    ? t('predictionSheet.advances', { code: qualifier === 'HOME' ? homeCode : awayCode })
    : t('predictionSheet.pickQualifier');

  return (
    <Modal transparent visible={!!match} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={saving ? undefined : close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.matchInfo}>
          <View style={styles.matchTeams}>
            <Flag code={match.homeTeam.code} size={22} />
            <Text style={styles.matchTitle}>{homeCode}</Text>
            <Text style={styles.matchVs}>{t('common.vs')}</Text>
            <Text style={styles.matchTitle}>{awayCode}</Text>
            <Flag code={match.awayTeam.code} size={22} />
          </View>
          <View style={styles.matchMetaRow}>
            <Text style={styles.matchMeta}>
              {groupLabel} · {dateStr} · {timeStr}
            </Text>
            {knockout && (
              <View style={styles.knockoutBadge}>
                <Text style={styles.knockoutBadgeText}>{t('predictionSheet.knockout')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Odds bar */}
        {match.odds && (
          <View style={styles.oddsCard}>
            {knockout ? (
              knockoutPct && (
                <KnockoutOddsBar
                  pct={knockoutPct}
                  homeColor={match.homeTeam.color || '#505a63'}
                  awayColor={match.awayTeam.color || '#505a63'}
                  homeLabel={homeCode}
                  awayLabel={awayCode}
                  visible
                />
              )
            ) : (
              groupPct && (
                <OddsBar
                  pct={groupPct}
                  homeColor={match.homeTeam.color || '#505a63'}
                  awayColor={match.awayTeam.color || '#505a63'}
                  homeLabel={homeCode}
                  awayLabel={awayCode}
                  visible
                />
              )
            )}
          </View>
        )}

        {/* Score pickers */}
        <View style={styles.scorePickers}>
          <ScoreControl
            value={score[0]}
            onChange={(v) => setScore([v, score[1]])}
            label={homeCode}
          />
          <Text style={styles.dash}>–</Text>
          <ScoreControl
            value={score[1]}
            onChange={(v) => setScore([score[0], v])}
            label={awayCode}
          />
        </View>

        {/* Knockout: qualifier picker */}
        {knockout && (
          <View style={styles.qualifierSection}>
            <Text style={styles.qualifierTitle}>{t('predictionSheet.whoAdvances')}</Text>
            <View style={styles.qualifierButtons}>
              <TouchableOpacity
                style={[
                  styles.qualifierBtn,
                  qualifier === 'HOME' && styles.qualifierBtnActive,
                  // Lock if score shows clear winner
                  !isDraw && score[0] < score[1] && styles.qualifierBtnDisabled,
                ]}
                onPress={() => isDraw && setQualifier('HOME')}
                disabled={!isDraw && score[0] < score[1]}
                activeOpacity={isDraw ? 0.7 : 1}
              >
                <Flag code={match.homeTeam.code} size={18} />
                <Text style={[
                  styles.qualifierBtnText,
                  qualifier === 'HOME' && styles.qualifierBtnTextActive,
                ]}>
                  {homeCode}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.qualifierBtn,
                  qualifier === 'AWAY' && styles.qualifierBtnActive,
                  !isDraw && score[0] > score[1] && styles.qualifierBtnDisabled,
                ]}
                onPress={() => isDraw && setQualifier('AWAY')}
                disabled={!isDraw && score[0] > score[1]}
                activeOpacity={isDraw ? 0.7 : 1}
              >
                <Flag code={match.awayTeam.code} size={18} />
                <Text style={[
                  styles.qualifierBtnText,
                  qualifier === 'AWAY' && styles.qualifierBtnTextActive,
                ]}>
                  {awayCode}
                </Text>
              </TouchableOpacity>
            </View>
            {isDraw && !qualifier && (
              <Text style={styles.qualifierHint}>{t('predictionSheet.pickQualifierHint')}</Text>
            )}
          </View>
        )}

        {/* Points preview */}
        {knockout ? (
          <View style={styles.pointsPreview}>
            <View style={[styles.pointsCard, styles.pointsCardExact]}>
              <Text style={[styles.pointsValue, { color: colors.accent }]}>+{advancingPts}</Text>
              <Text style={[styles.pointsLabel, { color: colors.accent }]}>
                {qualifier
                  ? t('predictionSheet.ptsIfAdvances', { code: qualifier === 'HOME' ? homeCode : awayCode })
                  : t('predictionSheet.ptsIfAdvances', { code: '?' })}
              </Text>
              <Text style={styles.pointsHint}>{qualifierLabel}</Text>
            </View>
            <View style={[styles.pointsCard, styles.pointsCardOutcome]}>
              <Text style={[styles.pointsValue, { color: colors.blue }]}>+{exactBonusKnockout}</Text>
              <Text style={[styles.pointsLabel, { color: colors.blue }]}>
                {t('predictionSheet.ptsIfExactKnockout')}
              </Text>
              <Text style={styles.pointsHint}>
                {score[0]}–{score[1]}
              </Text>
            </View>
          </View>
        ) : groupPct ? (
          <View style={styles.pointsPreview}>
            <View style={[styles.pointsCard, styles.pointsCardExact]}>
              <Text style={[styles.pointsValue, { color: colors.accent }]}>+{exactPtsGroup}</Text>
              <Text style={[styles.pointsLabel, { color: colors.accent }]}>
                {t('predictionSheet.ptsIfExact')}
              </Text>
              <Text style={styles.pointsHint}>
                {score[0]}–{score[1]}
              </Text>
            </View>
            <View style={[styles.pointsCard, styles.pointsCardOutcome]}>
              <Text style={[styles.pointsValue, { color: colors.blue }]}>+{outcomePtsGroup}</Text>
              <Text style={[styles.pointsLabel, { color: colors.blue }]}>
                {t('predictionSheet.ptsIfOutcome', { outcome: groupOutcomeLabel })}
              </Text>
              <Text style={styles.pointsHint}>
                {t('predictionSheet.pctLikely', { pct: outcomeProb })}
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{t('predictionSheet.save')}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
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
  matchInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  matchTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  matchVs: {
    color: colors.dim,
    fontSize: 12,
  },
  matchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchMeta: {
    color: colors.dim,
    fontSize: 12,
  },
  knockoutBadge: {
    backgroundColor: 'rgba(236,126,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236,126,0,0.35)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  knockoutBadgeText: {
    color: 'rgba(236,126,0,0.95)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.display,
    letterSpacing: 0.5,
  },
  oddsCard: {
    backgroundColor: colors.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 18,
  },
  scorePickers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  scoreLabel: {
    color: colors.dim,
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: fonts.display,
  },
  stepper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIcon: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 22,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 52,
    fontWeight: '700',
    fontFamily: fonts.display,
    width: 64,
    textAlign: 'center',
    lineHeight: 60,
  },
  dash: {
    color: colors.dim,
    fontSize: 32,
    fontWeight: '300',
    paddingHorizontal: 4,
    marginTop: 16,
  },
  qualifierSection: {
    marginBottom: 18,
  },
  qualifierTitle: {
    color: colors.dim,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: fonts.display,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  qualifierButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  qualifierBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card2,
  },
  qualifierBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0,168,126,0.12)',
  },
  qualifierBtnDisabled: {
    opacity: 0.35,
  },
  qualifierBtnText: {
    color: colors.dim,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.display,
    letterSpacing: 0.5,
  },
  qualifierBtnTextActive: {
    color: colors.accent,
  },
  qualifierHint: {
    color: 'rgba(236,126,0,0.8)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: fonts.body,
  },
  pointsPreview: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  pointsCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  pointsCardExact: {
    backgroundColor: 'rgba(0,168,126,0.08)',
    borderColor: 'rgba(0,168,126,0.25)',
  },
  pointsCardOutcome: {
    backgroundColor: 'rgba(73,79,223,0.08)',
    borderColor: 'rgba(73,79,223,0.25)',
  },
  pointsValue: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.display,
    lineHeight: 26,
  },
  pointsLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
    opacity: 0.85,
  },
  pointsHint: {
    color: colors.dim,
    fontSize: 9,
    marginTop: 4,
  },
  saveBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.display,
  },
});
