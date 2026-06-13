import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme';

const H_MARGIN = 16;
const BAR_PADDING = 6;
const BAR_HEIGHT = 64;

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnimation = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(indicatorAnimation, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [state.index, indicatorAnimation]);

  const tabCount = state.routes.length;
  const innerWidth = barWidth > 0 ? barWidth - BAR_PADDING * 2 : 0;
  const indicatorWidth = innerWidth > 0 ? innerWidth / tabCount : 0;
  const indicatorTranslate = indicatorAnimation.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => index * indicatorWidth),
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + 24 }]}
    >
      <View
        style={styles.bar}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.fill} pointerEvents="none" />
        <View style={styles.topHighlight} pointerEvents="none" />

        {indicatorWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: indicatorWidth, transform: [{ translateX: indicatorTranslate }] },
            ]}
          />
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? colors.accent : colors.dim;

          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={styles.tab}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: H_MARGIN,
    right: H_MARGIN,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.borderMid,
    overflow: 'hidden',
    // Soft shadow so the bar reads as "floating" glass.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    // Translucent fallback so the bar still looks glassy where blur is weak/unsupported (web).
    backgroundColor: Platform.OS === 'android' ? 'rgba(24,27,33,0.92)' : 'rgba(24,27,33,0.55)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING,
    left: BAR_PADDING,
    bottom: BAR_PADDING,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(0,168,126,0.35)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 3,
    zIndex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    // Stretch to the slot width + center so a long label (e.g. "Predicciones")
    // stays within the active pill instead of spilling past it.
    alignSelf: 'stretch',
    textAlign: 'center',
  },
});
