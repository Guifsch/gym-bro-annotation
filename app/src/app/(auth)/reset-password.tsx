import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resetPassword } from '@/auth/authApi';
import { AuthBadge } from '@/components/auth-badge';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), password });
      router.replace('/(auth)/login');
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
          Nova senha
        </ThemedText>

        <Card style={styles.card}>
          <LabeledTextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={254}
          />
          <LabeledTextField label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <LabeledTextField
            label="Nova senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            maxLength={128}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <GradientButton
            title="Redefinir senha"
            onPress={handleSubmit}
            loading={loading}
            disabled={!email || code.length !== 6 || password.length < 8}
          />
        </Card>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six, gap: Spacing.three },
  title: { textAlign: 'center' },
  card: { gap: Spacing.three },
  error: { color: '#e53935' },
});
