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
import { useAuthStore } from '../store/authStore';
import { colors, spacing, borderRadius } from '../theme';
import { useI18n } from '../i18n';
import { usePendingInviteStore } from '../store/pendingInviteStore';
import { getApiBaseUrl } from '../api/client';
import PwaInstallPrompt from '../components/PwaInstallPrompt';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

function getRegisterErrorMessage(error: unknown, t: (key: string) => string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) {
      return t('register.emailTaken');
    }

    const responseError = error.response?.data?.error;
    if (typeof responseError === 'string') {
      return responseError;
    }

    if (!error.response) {
      const detail = __DEV__ ? `\n${getApiBaseUrl()}\n${error.message}` : '';
      return `${t('login.networkFailed')}${detail}`;
    }
  }

  return t('register.failed');
}

export default function RegisterScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const register = useAuthStore((s) => s.register);
  const pendingInviteCode = usePendingInviteStore((s) => s.pendingInviteCode);
  const pendingInviteLeagueName = usePendingInviteStore((s) => s.pendingInviteLeagueName);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!normalizedEmail || !trimmedName || !password) {
      setError(t('register.required'));
      return;
    }

    if (password.length < 8) {
      setError(t('register.passwordTooShort'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await register(normalizedEmail, trimmedName, password);
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn('[register] Registration failed', {
          apiUrl: getApiBaseUrl(),
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
          body: axios.isAxiosError(error) ? error.response?.data : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      setError(getRegisterErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.innerContainer, { opacity: fadeAnim }]}>
        <View style={styles.glowTop} pointerEvents="none" />
        <View style={styles.glowBottom} pointerEvents="none" />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.spacerTop} />

          <View style={styles.logoSection}>
            <Image
              source={{ uri: 'https://digitalhub.fifa.com/transform/157d23bf-7e13-4d7b-949e-5d27d340987e/WC26_Logo' }}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.titleBox}>
              <Text style={styles.title}>{t('register.title')}</Text>
              <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
            </View>
          </View>

          {pendingInviteCode ? (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteTitle}>{t('invite.pendingTitle')}</Text>
              <Text style={styles.inviteText}>
                {t('invite.pendingRegisterMessage', {
                  code: pendingInviteCode,
                  leagueName: pendingInviteLeagueName ?? '',
                })}
              </Text>
            </View>
          ) : null}

          {pendingInviteCode ? <PwaInstallPrompt /> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.ctaSection}>
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>{t('register.name')}</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                placeholder={t('register.namePlaceholder')}
                placeholderTextColor={colors.dim}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.formLabel}>{t('register.email')}</Text>
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
              <Text style={styles.formLabel}>{t('register.password')}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder={t('register.passwordPlaceholder')}
                placeholderTextColor={colors.dim}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleRegister}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('register.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signInLink} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInLinkText}>{t('register.alreadyHaveAccount')}</Text>
            </TouchableOpacity>

            <Text style={styles.fine}>{t('register.finePrint')}</Text>
          </View>

          <View style={styles.spacerBottom} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
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
  spacerTop: { height: 60 },
  spacerBottom: { height: 40 },

  logoSection: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  logo: {
    width: 90,
    height: 90,
  },
  titleBox: {
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 28,
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
  inviteBanner: {
    backgroundColor: 'rgba(0,168,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,168,126,0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 4,
  },
  inviteTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  inviteText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
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
  submitBtn: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signInLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  fine: {
    color: colors.dim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
});
