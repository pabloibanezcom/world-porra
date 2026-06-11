import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

interface Props {
  compact?: boolean;
  style?: ViewStyle;
}

export default function LiveBadge({ compact, style }: Props) {
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const dotScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.35],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });

  return (
    <Animated.View style={[styles.pill, compact && styles.pillCompact, style]}>
      <Animated.View style={[styles.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]} />
      <Text style={[styles.text, compact && styles.textCompact]}>{t('common.live')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(226,59,74,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  text: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
  textCompact: {
    fontSize: 10,
    fontWeight: '800',
  },
});
