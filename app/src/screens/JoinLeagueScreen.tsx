import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { joinLeague } from '../api/leagues';
import { colors, spacing, fontSize, borderRadius } from '../theme';

export default function JoinLeagueScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const handleJoin = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Error', 'Invite code must be 6 characters');
      return;
    }

    setLoading(true);
    try {
      const league = await joinLeague(code.trim().toUpperCase());
      Alert.alert('Joined!', `Welcome to ${league.name}`, [
        { text: 'OK', onPress: () => navigation.navigate('LeagueDetail', { leagueId: league._id }) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to join league');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Invite Code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="e.g. A1B2C3"
        maxLength={6}
        autoCapitalize="characters"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join League</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.xl,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
});
