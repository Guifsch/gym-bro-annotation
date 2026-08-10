import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerRequest } from '@/auth/authApi';
import { AuthBadge } from '@/components/auth-badge';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirmPassword;

  async function handleSubmit() {
    setError(null);
    if (!passwordsMatch) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      await registerRequest({ name: name.trim(), email: trimmedEmail, password });
      router.push({ pathname: '/(auth)/register-code', params: { email: trimmedEmail } });
    } catch {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AuthBadge />
        <ThemedText type="title" style={styles.title}>
          Criar conta
        </ThemedText>

        <Card style={styles.card}>
          <LabeledTextField
            label="Nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={80}
          />
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
          <LabeledTextField
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            maxLength={128}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <GradientButton
            title="Criar conta"
            onPress={handleSubmit}
            loading={loading}
            disabled={!name || !email || password.length < 8 || !confirmPassword || !passwordsMatch}
          />
        </Card>

        <Link href="/(auth)/login" asChild>
          <ThemedText type="linkPrimary" style={styles.link}>
            Voltar ao login
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
