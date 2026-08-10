import { Link, router } from 'expo-router';
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

export default function LoginScreen() {
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(email.trim(), password);
      router.replace('/(tabs)/treinos');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AuthBadge />
        <ThemedText type="title" style={styles.title}>
          Entrar
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
          <LabeledTextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            maxLength={128}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <GradientButton title="Entrar" onPress={handleSubmit} loading={loading} disabled={!email || !password} />
        </Card>

        <Link href="/(auth)/register" asChild>
          <ThemedText type="linkPrimary" style={styles.link}>
            Criar conta
          </ThemedText>
        </Link>
        <Link href="/(auth)/forgot-password" asChild>
          <ThemedText type="linkPrimary" style={styles.link}>
            Esqueci minha senha
          </ThemedText>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six, gap: Spacing.three },
  title: { textAlign: 'center' },
  card: { gap: Spacing.three },
  link: { textAlign: 'center' },
  error: { color: '#e53935' },
});
