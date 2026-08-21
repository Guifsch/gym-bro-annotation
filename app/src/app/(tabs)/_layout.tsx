import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/auth/authStore';
import { LoadingView } from '@/components/loading-view';
import { MINI_TIMER_BAR_HEIGHT, MiniTimerBar } from '@/components/mini-timer-bar';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTimerStore } from '@/stores/timerStore';

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
  const miniBarEnabled = useTimerStore((s) => s.miniBarEnabled);
  const hydrateTimer = useTimerStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'idle') {
      bootstrap();
    }
  }, [status, bootstrap]);

  useEffect(() => {
    if (status === 'authenticated') {
      void hydrateTimer();
    }
  }, [status, hydrateTimer]);

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

  // Growing the tab bar's own height (rather than floating the mini bar as an unrelated overlay)
  // makes React Navigation shrink every tab screen's content area by the same amount automatically
  // — no per-screen padding changes needed. `paddingTop` pushes the actual tab icons/labels back
  // down to their normal height, leaving the added space empty at the top of the (taller) bar,
  // which is exactly where the absolutely-positioned MiniTimerBar below is glued.
  const baseTabBarHeight = 64 + insets.bottom;
  const tabBarHeight = baseTabBarHeight + (miniBarEnabled ? MINI_TIMER_BAR_HEIGHT : 0);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Brand.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarActiveBackgroundColor: 'rgba(21, 181, 128, 0.14)',
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            height: tabBarHeight,
            paddingBottom: 8 + insets.bottom,
            paddingTop: miniBarEnabled ? MINI_TIMER_BAR_HEIGHT : 0,
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
          name="extras"
          options={{
            title: 'Extras',
            tabBarIcon: ({ color, size }) => <Ionicons name="apps-outline" size={size} color={color} />,
          }}
        />
      </Tabs>

      {miniBarEnabled && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: baseTabBarHeight }}>
          <MiniTimerBar />
        </View>
      )}
    </View>
  );
}
