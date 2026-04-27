import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';

interface AvatarProps {
  name: string;
  color?: string;
  imageUrl?: string;
  size?: number;
}

export default function Avatar({ name, color = '#494fdf', imageUrl, size = 36 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
});
