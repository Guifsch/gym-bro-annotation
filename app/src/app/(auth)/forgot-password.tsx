import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { forgotPassword } from '@/auth/authApi';
import { AuthBadge } from '@/components/auth-badge';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      await forgotPassword({ email: trimmedEmail });
      router.push({ pathname: '/(auth)/reset-password', params: { email: trimmedEmail } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AuthBadge />
        <ThemedText type="title" style={styles.title}>
          Recuperar senha
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Informe seu e-mail para receber um código de redefinição.
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

          <GradientButton title="Enviar código" onPress={handleSubmit} loading={loading} disabled={!email} />
        </Card>

        <Link href="/(auth)/reset-password" asChild>
          <ThemedText type="linkPrimary" style={styles.link}>
            Já tenho um código
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
  subtitle: { textAlign: 'center' },
  card: { gap: Spacing.three },
  link: { textAlign: 'center' },
});
