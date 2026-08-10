import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/auth/authStore';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useResolvedThemeName, useTheme } from '@/hooks/use-theme';
import { useThemePreferenceStore } from '@/hooks/useThemePreference';

interface TabHeaderProps {
  title: string;
}

export function TabHeader({ title }: TabHeaderProps) {
  const theme = useTheme();
  const themeName = useResolvedThemeName();
  const setThemeOverride = useThemePreferenceStore((s) => s.setOverride);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  function handleToggleTheme() {
    setThemeOverride(themeName === 'dark' ? 'light' : 'dark');
  }

  return (
    <View style={styles.row}>
      <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/perfil')}
          hitSlop={12}
          style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="person-outline" size={18} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={handleToggleTheme}
          hitSlop={12}
          style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name={themeName === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={handleLogout}
          hitSlop={12}
          style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="log-out-outline" size={18} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flexShrink: 1, marginRight: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.two, flexShrink: 0 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
