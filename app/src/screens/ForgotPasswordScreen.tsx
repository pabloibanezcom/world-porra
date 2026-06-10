import React, { useRef } from 'react';
import axios from 'axios';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../api/auth';
import { getApiBaseUrl } from '../api/client';
import { useI18n } from '../i18n';
import { colors } from '../theme';

type AuthStackParamList = {
  Login: undefined;
};

function getRequestErrorMessage(error: unknown, t: (key: string) => string): string {
  if (axios.isAxiosError(error) && !error.response) {
    const detail = __DEV__ ? `\n${getApiBaseUrl()}\n${error.message}` : '';
    return `${t('login.networkFailed')}${detail}`;
  }

  return t('passwordReset.requestFailed');
}

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t('passwordReset.emailRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(normalizedEmail);
      setMessage(t('passwordReset.requestSent'));
    } catch (error: unknown) {
      setError(getRequestErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.innerContainer, { opacity: fadeAnim }]}>
        <View style={styles.glowTop} pointerEvents="none" />
        <View style={styles.glowBottom} pointerEvents="none" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.spacerTop} />
          <View style={styles.logoSection}>
            <Image
              source={{ uri: 'https://digitalhub.fifa.com/transform/157d23bf-7e13-4d7b-949e-5d27d340987e/WC26_Logo' }}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.titleBox}>
              <Text style={styles.title}>{t('passwordReset.forgotTitle')}</Text>
              <Text style={styles.subtitle}>{t('passwordReset.forgotSubtitle')}</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

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
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('passwordReset.sendLink')}</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>{t('passwordReset.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.spacerBottom} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  innerContainer: { flex: 1 },
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
  scroll: { paddingHorizontal: 28 },
  spacerTop: { height: 70 },
  spacerBottom: { height: 40 },
  logoSection: { alignItems: 'center', gap: 16, marginBottom: 32 },
  logo: { width: 90, height: 90 },
  titleBox: { alignItems: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  error: { color: colors.danger, textAlign: 'center', marginBottom: 12, fontSize: 13 },
  success: { color: colors.accent, textAlign: 'center', marginBottom: 12, fontSize: 13, lineHeight: 19 },
  ctaSection: { gap: 12 },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  formLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
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
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
});
