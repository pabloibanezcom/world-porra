import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, borderRadius } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const hasGoogleConfig = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export default function LoginScreen() {
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handlePasswordLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithPassword(normalizedEmail, password);
    } catch {
      setError('Email/password login failed. Please check your credentials.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <Animated.View style={[styles.innerContainer, { opacity: fadeAnim }]}>
      {/* Decorative glow */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.spacerTop} />

        {/* Logo + title */}
        <View style={styles.logoSection}>
          <Image
            source={{ uri: 'https://digitalhub.fifa.com/transform/157d23bf-7e13-4d7b-949e-5d27d340987e/WC26_Logo' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleBox}>
            <Text style={styles.title}>World Cup Pool</Text>
            <Text style={styles.subtitle}>2026 FIFA · USA · Canada · Mexico</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* CTA */}
        <View style={styles.ctaSection}>
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.dim}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.formLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor={colors.dim}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={[styles.passwordBtn, isSigningIn && styles.googleBtnDisabled]}
              onPress={handlePasswordLogin}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.passwordBtnText}>Continue with Email</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {hasGoogleConfig ? (
            <GoogleLoginButton isSigningIn={isSigningIn} setIsSigningIn={setIsSigningIn} setError={setError} />
          ) : (
            <TouchableOpacity style={[styles.googleBtn, styles.googleBtnDisabled]} disabled>
              <Text style={[styles.googleBtnText, { color: '#666' }]}>Sign in with Google (not configured)</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.fine}>
            By continuing you agree to the pool rules.{'\n'}Your picks are visible to other members.
          </Text>
        </View>

        <View style={styles.spacerBottom} />
      </ScrollView>
    </Animated.View>
    </SafeAreaView>
  );
}

function GoogleLoginButton({
  isSigningIn,
  setIsSigningIn,
  setError,
}: {
  isSigningIn: boolean;
  setIsSigningIn: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
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
    <TouchableOpacity
      style={[styles.googleBtn, (!request || isSigningIn) && styles.googleBtnDisabled]}
      onPress={() => promptAsync()}
      disabled={!request || isSigningIn}
    >
      {isSigningIn ? (
        <ActivityIndicator color="#444" />
      ) : (
        <Image
          source={{ uri: 'https://www.google.com/favicon.ico' }}
          style={{ width: 20, height: 20 }}
        />
      )}
      <Text style={[styles.googleBtnText, isSigningIn && { color: '#666' }]}>
        {isSigningIn ? 'Signing in…' : 'Continue with Google'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  innerContainer: {
    flex: 1,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    left: '50%',
    marginLeft: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0,168,126,0.08)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 120,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(73,79,223,0.06)',
  },
  scroll: {
    paddingHorizontal: 28,
  },
  spacerTop: { height: 80 },
  spacerBottom: { height: 40 },

  logoSection: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  logo: {
    width: 110,
    height: 110,
  },
  titleBox: {
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },

  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },

  ctaSection: {
    gap: 12,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  formLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  passwordBtn: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 9999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  passwordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.dim,
    fontSize: 12,
  },
  googleBtn: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleBtnDisabled: {
    opacity: 0.7,
  },
  googleBtnText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  fine: {
    color: colors.dim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
});
