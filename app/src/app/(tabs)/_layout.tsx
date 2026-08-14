import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/auth/authStore';
import { LoadingView } from '@/components/loading-view';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The default tab button uses `android_ripple: { borderless: true }`, so the touch feedback flashes
 * as a circle that ignores the tab item's rectangular bounds — inconsistent with the square active
 * background. `borderless: false` clips the ripple to the button's own shape instead.
 */
function TabButton({ style, onPress, onLongPress, accessibilityLabel, testID, children }: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      android_ripple={{ borderless: false }}
      style={style}>
      {children}
    </Pressable>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') {
      bootstrap();
    }
  }, [status, bootstrap]);

  // The native splash (branded, reliable) stays up for the whole auth check instead of handing off to
  // any in-JS loading screen — that check can take a while on a Render cold start, and a splash that's
  // already proven visible beats a custom screen that might not paint the instant the splash goes away.
  useEffect(() => {
    if (status === 'authenticated' || status === 'anonymous') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'anonymous') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status !== 'authenticated') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <LoadingView label="Conectando..." />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: 'rgba(21, 181, 128, 0.14)',
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarButton: TabButton,
      }}>
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendário',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercicios"
        options={{
          title: 'Exercícios',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="treinos"
        options={{
          title: 'Treinos',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
