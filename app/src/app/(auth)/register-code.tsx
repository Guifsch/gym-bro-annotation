import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/auth/authStore';
import { AuthBadge } from '@/components/auth-badge';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function RegisterCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const confirmRegistration = useAuthStore((s) => s.confirmRegistration);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await confirmRegistration(email, code.trim());
      router.replace('/(tabs)/treinos');
    } catch {
      setError('Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AuthBadge />
        <ThemedText type="title" style={styles.title}>
          Confirmar código
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Enviamos um código de 6 dígitos para {email}.
        </ThemedText>

        <Card style={styles.card}>
          <LabeledTextField label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <GradientButton title="Confirmar" onPress={handleSubmit} loading={loading} disabled={code.length !== 6} />
        </Card>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six, gap: Spacing.three },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  card: { gap: Spacing.three },
  error: { color: '#e53935' },
});
