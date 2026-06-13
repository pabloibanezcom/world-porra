import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

interface Props {
  urgent: boolean;
  countdownLabel?: string;
}

export default function PredictBadge({ urgent, countdownLabel }: Props) {
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!urgent) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [urgent, pulse]);

  if (!urgent) {
    return (
      <View style={styles.calmPill}>
        <Text style={styles.calmText}>{t('matchCard.predict')}</Text>
      </View>
    );
  }

  const dotScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.35],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });

  return (
    <View style={styles.urgentPill}>
      <Animated.View style={[styles.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]} />
      <Text style={styles.urgentText}>{t('matchCard.predict')}</Text>
      {!!countdownLabel && <Text style={styles.countdownText}> · {countdownLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  calmPill: {
    backgroundColor: colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calmText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  urgentPill: {
    backgroundColor: 'rgba(236,126,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(236,126,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  urgentText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bodyMedium,
  },
  countdownText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
});
