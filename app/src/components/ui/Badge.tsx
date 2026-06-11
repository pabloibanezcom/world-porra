import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

type Result = 'exact' | 'correct' | 'wrong';

const CONFIG: Record<Result, { label: string; bg: string; color: string }> = {
  exact: { label: '+10', bg: colors.accentDim, color: colors.accent },
  correct: { label: '+4', bg: colors.blueDim, color: colors.blue },
  wrong: { label: '0', bg: 'rgba(226,59,74,0.12)', color: colors.danger },
};

interface BadgeProps {
  result: Result;
  // Actual points earned for this prediction. When provided, the badge shows
  // the real total instead of the static placeholder label (points are
  // odds-based, so an exact pick is rarely exactly +10).
  points?: number | null;
}

export default function Badge({ result, points }: BadgeProps) {
  const cfg = CONFIG[result];
  const label =
    points != null ? (points > 0 ? `+${points}` : `${points}`) : cfg.label;
  return (
    <View style={[styles.base, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
