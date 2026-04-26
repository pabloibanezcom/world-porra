import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSend: (title: string, body: string) => Promise<void>;
}

export default function NotifyModal({ visible, title, onClose, onSend }: Props) {
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSending(true);
    try {
      await onSend(notifTitle.trim(), notifBody.trim());
      setNotifTitle('');
      setNotifBody('');
      onClose();
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setNotifTitle('');
    setNotifBody('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.heading}>{title}</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={notifTitle}
            onChangeText={setNotifTitle}
            placeholder="Notification title"
            placeholderTextColor={colors.dim}
            maxLength={100}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notifBody}
            onChangeText={setNotifBody}
            placeholder="Write your message…"
            placeholderTextColor={colors.dim}
            multiline
            maxLength={300}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={sending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (!notifTitle.trim() || !notifBody.trim()) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending || !notifTitle.trim() || !notifBody.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    marginBottom: 4,
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
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  sendBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
});
