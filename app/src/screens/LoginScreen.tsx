import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, fontSize, borderRadius } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setIsSigningIn(true);
      setError(null);
      signInWithGoogle(id_token)
        .catch(() => setError('Sign in failed. Please try again.'))
        .finally(() => setIsSigningIn(false));
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>⚽</Text>
        <Text style={styles.title}>WC 2026</Text>
        <Text style={styles.subtitle}>Predict & Compete</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Predict match scores, compete with friends, and climb the leaderboard during the FIFA World Cup 2026.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.googleButton, !request && styles.disabledButton]}
          onPress={() => promptAsync()}
          disabled={!request || isSigningIn}
        >
          {isSigningIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.accent,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
  },
  description: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  error: {
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
