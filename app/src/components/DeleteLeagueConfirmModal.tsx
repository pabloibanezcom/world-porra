import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

interface Props {
  visible: boolean;
  leagueName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteLeagueConfirmModal({ visible, leagueName, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const word = t('league.deleteWord');
  const confirmed = input.trim().toLowerCase() === word.toLowerCase();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const close = () => {
    if (deleting) return;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setInput('');
      onClose();
    });
  };

  const handleConfirm = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <Text style={styles.heading}>{t('league.deleteTitle')}</Text>
          <Text style={styles.body}>{t('league.deleteConfirm', { name: leagueName })}</Text>

          <Text style={styles.label}>{t('league.deleteInputLabel', { word })}</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={word}
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={deleting}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !confirmed && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!confirmed || deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{t('league.deleteAction')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    paddingBottom: 44,
    gap: 12,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
});
