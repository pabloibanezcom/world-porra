import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

const DISMISS_STORAGE_KEY = 'world-porra.pwaInstallDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneDisplay(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function getWebInstallPlatform(): 'ios-safari' | 'android-chrome' | 'unsupported' {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';

  const userAgent = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/iu.test(userAgent);
  const isSafari = /safari/iu.test(userAgent) && !/crios|fxios|edgios/iu.test(userAgent);
  if (isIOS && isSafari) return 'ios-safari';

  const isAndroid = /android/iu.test(userAgent);
  const isChrome = /chrome|crios/iu.test(userAgent) && !/edg/iu.test(userAgent);
  if (isAndroid && isChrome) return 'android-chrome';

  return 'unsupported';
}

function wasDismissed(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
}

function setDismissed(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
}

export default function PwaInstallPrompt() {
  const { t } = useI18n();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissedState] = useState(() => wasDismissed());
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const installPlatform = useMemo(() => getWebInstallPlatform(), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || dismissed || installed || installPlatform === 'unsupported') {
    return null;
  }

  const handleDismiss = () => {
    setDismissed();
    setDismissedState(true);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallPrompt(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('install.title')}</Text>
        <Text style={styles.body}>
          {installPlatform === 'ios-safari' ? t('install.iosBody') : t('install.androidBody')}
        </Text>
      </View>
      <View style={styles.actions}>
        {installPlatform === 'android-chrome' && installPrompt ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleInstall} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{t('install.action')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.75}>
          <Text style={styles.dismissButtonText}>{t('install.dismiss')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  copy: {
    gap: 5,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
});
