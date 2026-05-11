import React, { useEffect, useRef } from 'react';
import axios from 'axios';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, borderRadius } from '../theme';
import { useI18n } from '../i18n';
import { getGoogleClientIds, getGoogleIdToken, hasGoogleClientIdForPlatform } from '../auth/googleConfig';
import { getApiBaseUrl } from '../api/client';
import ApiScenarioSelector from '../components/ApiScenarioSelector';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

WebBrowser.maybeCompleteAuthSession();

const googleClientIds = getGoogleClientIds();

function getPasswordLoginErrorMessage(error: unknown, t: (key: string) => string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      return t('login.passwordFailed');
    }

    if (!error.response) {
      const detail = __DEV__ ? `\n${getApiBaseUrl()}\n${error.message}` : '';
      return `${t('login.networkFailed')}${detail}`;
    }
  }

  return t('login.signInFailed');
}

export default function LoginScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const signInDev = useAuthStore((s) => s.signInDev);
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
      setError(t('login.required'));
      return;
    }

    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithPassword(normalizedEmail, password);
    } catch (error) {
      if (__DEV__) {
        console.warn('[login] Password login failed', {
          apiUrl: getApiBaseUrl(),
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      setError(getPasswordLoginErrorMessage(error, t));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDevLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setIsSigningIn(true);
    setError(null);
    try {
      await signInDev(normalizedEmail || undefined);
    } catch (error) {
      if (__DEV__) {
        console.warn('[login] Dev login failed', {
          apiUrl: getApiBaseUrl(),
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      setError(getPasswordLoginErrorMessage(error, t));
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
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          </View>
        </View>

        <ApiScenarioSelector />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* CTA */}
        <View style={styles.ctaSection}>
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>{t('login.email')}</Text>
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
            <Text style={styles.formLabel}>{t('login.password')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder={t('login.passwordPlaceholder')}
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
                <Text style={styles.passwordBtnText}>{t('login.continueEmail')}</Text>
              )}
            </TouchableOpacity>
            {__DEV__ ? (
              <TouchableOpacity
                style={[styles.devBtn, isSigningIn && styles.googleBtnDisabled]}
                onPress={handleDevLogin}
                disabled={isSigningIn}
              >
                <Text style={styles.devBtnText}>
                  {email.trim() ? 'Dev: switch to email' : 'Dev: sign in'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('login.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {hasGoogleClientIdForPlatform(googleClientIds) ? (
            <GoogleLoginButton isSigningIn={isSigningIn} setIsSigningIn={setIsSigningIn} setError={setError} />
          ) : (
            <TouchableOpacity style={[styles.googleBtn, styles.googleBtnDisabled]} disabled>
              <Text style={[styles.googleBtnText, { color: '#666' }]}>{t('login.googleNotConfigured')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>{t('login.createAccount')}</Text>
          </TouchableOpacity>

          <Text style={styles.fine}>
            {t('login.finePrint')}
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
  const { t } = useI18n();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = getGoogleIdToken(response);
      if (!idToken) {
        setError(t('login.signInFailed'));
        return;
      }

      setIsSigningIn(true);
      setError(null);
      signInWithGoogle(idToken)
        .catch(() => setError(t('login.signInFailed')))
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
        {isSigningIn ? t('login.signingIn') : t('login.continueGoogle')}
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
    borderRadius: 12,
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
  devBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  devBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: 12,
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
  registerLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
