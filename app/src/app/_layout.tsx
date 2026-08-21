import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
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
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    loadThemePreference().finally(() => setThemeLoaded(true));
    startOfflineQueueEngine();
  }, [loadThemePreference]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors[themeName].background);
  }, [themeName]);

  // Keep the native splash up until the theme preference AND the custom font have loaded — hiding
  // it earlier leaves a raw black gap, or a flash of the system font before Poppins swaps in, on
  // screen before the first JS frame commits. It's hidden for good once auth status resolves (see
  // (tabs)/_layout.tsx) — not here — since that check itself can take a while (Render free-tier
  // cold start), and the branded splash is a better "please wait" than any custom screen.
  if (!themeLoaded || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
