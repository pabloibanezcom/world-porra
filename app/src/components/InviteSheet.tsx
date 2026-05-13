import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';
import { buildInviteUrl } from '../utils/inviteLinks';

interface InviteSheetProps {
  visible: boolean;
  leagueName: string;
  inviteCode: string;
  onClose: () => void;
}

export default function InviteSheet({ visible, leagueName, inviteCode, onClose }: InviteSheetProps) {
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleShare = async () => {
    const inviteUrl = buildInviteUrl(inviteCode, leagueName);
    await Share.share({
      message: t('league.shareMessage', { name: leagueName, code: inviteCode, url: inviteUrl }),
      url: inviteUrl,
    });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <Text style={styles.label}>{t('league.inviteCode').toUpperCase()}</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.hint}>{t('league.inviteHint')}</Text>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>{t('common.share')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    paddingBottom: 44,
    alignItems: 'center',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 28,
  },
  label: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  code: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: 16,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  shareBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.display,
  },
});
