import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { colors, borderRadius } from '../theme';
import Flag from './ui/Flag';
import { Match } from '../types';
import { hasTbdTeam } from './MatchCard';
import { useI18n } from '../i18n';

interface PredictionSheetProps {
  match: Match | null;
  existing?: [number, number];
  onSave: (matchId: string, score: [number, number]) => void;
  onClose: () => void;
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
  const [score, setScore] = useState<[number, number]>(existing || [0, 0]);
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (match) {
      setScore(existing || [0, 0]);
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

  const save = () => {
    if (!match) return;
    if (hasTbdTeam(match)) return;
    onSave(match._id, score);
    close();
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

  return (
    <Modal transparent visible={!!match} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.matchInfo}>
          <View style={styles.matchTeams}>
            <Flag code={match.homeTeam.code} size={22} />
            <Text style={styles.matchTitle}>
              {match.homeTeam.name} {t('common.vs')} {match.awayTeam.name}
            </Text>
            <Flag code={match.awayTeam.code} size={22} />
          </View>
          <Text style={styles.matchMeta}>
            {groupLabel} · {dateStr} · {timeStr}
          </Text>
        </View>

        <View style={styles.scorePickers}>
          <ScoreControl
            value={score[0]}
            onChange={(v) => setScore([v, score[1]])}
            label={match.homeTeam.name}
          />
          <Text style={styles.dash}>–</Text>
          <ScoreControl
            value={score[1]}
            onChange={(v) => setScore([score[0], v])}
            label={match.awayTeam.name}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>{t('predictionSheet.save')}</Text>
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
    marginBottom: 24,
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
  },
  matchMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  scorePickers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
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
  saveBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
