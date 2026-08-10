import { isAxiosError } from 'axios';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { changePassword } from '@/auth/authApi';
import { useAuthStore } from '@/auth/authStore';
import { BackHeader } from '@/components/back-header';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { LabeledTextField } from '@/components/labeled-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { showToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error;
  }
  return fallback;
}

export default function PerfilScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const profileChanged = name.trim() !== user?.name || email.trim() !== user?.email;

  async function handleSaveProfile() {
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      showToast('Perfil atualizado');
    } catch (error) {
      setProfileError(extractErrorMessage(error, 'Não foi possível salvar. Tente novamente.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Senha atualizada');
    } catch (error) {
      setPasswordError(extractErrorMessage(error, 'Não foi possível atualizar a senha.'));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackHeader title="Perfil" />

        <Card style={styles.card}>
          <ThemedText type="smallBold">Dados pessoais</ThemedText>
          <LabeledTextField label="Nome" value={name} onChangeText={setName} maxLength={80} />
          <LabeledTextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={254}
          />
          {profileError && <ThemedText style={styles.error}>{profileError}</ThemedText>}
          <GradientButton
            title="Salvar"
            onPress={handleSaveProfile}
            loading={savingProfile}
            disabled={!name.trim() || !email.trim() || !profileChanged}
          />
        </Card>

        <Card style={styles.card}>
          <ThemedText type="smallBold">Alterar senha</ThemedText>
          <LabeledTextField
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            maxLength={128}
          />
          <LabeledTextField
            label="Nova senha"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            maxLength={128}
          />
          <LabeledTextField
            label="Confirmar nova senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            maxLength={128}
          />
          {passwordError && <ThemedText style={styles.error}>{passwordError}</ThemedText>}
          <GradientButton
            title="Atualizar senha"
            onPress={handleChangePassword}
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          />
        </Card>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  card: { gap: Spacing.two },
  error: { color: '#e53935' },
});
