import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/toast';
import { Colors } from '@/constants/theme';
import { useResolvedThemeName } from '@/hooks/use-theme';
import { useThemePreferenceStore } from '@/hooks/useThemePreference';
import { startOfflineQueueEngine } from '@/offline/lifecycle';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const themeName = useResolvedThemeName();
  const loadThemePreference = useThemePreferenceStore((s) => s.load);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    loadThemePreference().finally(() => setThemeLoaded(true));
    startOfflineQueueEngine();
  }, [loadThemePreference]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors[themeName].background);
  }, [themeName]);

  // Keep the native splash up until our own themed content has actually painted at least once —
  // hiding it as soon as the theme preference loads (the old behavior) left a raw black gap on
  // screen between the splash disappearing and the first JS frame committing.
  if (!themeLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={() => SplashScreen.hideAsync()}>
      <ThemeProvider value={themeName === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="perfil" />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
