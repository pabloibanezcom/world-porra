import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, fontSize, borderRadius } from '../theme';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={styles.container}>
      <View style={styles.profile}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  profile: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: fontSize.xxl, fontWeight: '700' },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  logoutButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  logoutText: { color: colors.error, fontSize: fontSize.md, fontWeight: '600' },
});
