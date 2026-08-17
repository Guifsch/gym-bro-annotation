import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useAuthStore } from '@/auth/authStore';
import { ThemedView } from '@/components/themed-view';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') {
      bootstrap();
    }
  }, [status, bootstrap]);

  // This is the one place that observes every possible outcome of the auth check (authenticated AND
  // anonymous), so it's the right place to hide the native splash — (tabs)/_layout.tsx only mounts
  // once already authenticated and never fires for a fresh install/expired session, which used to
  // leave the splash stuck on screen forever over an already-rendered (but invisible) login screen.
  useEffect(() => {
    if (status === 'authenticated' || status === 'anonymous') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'idle' || status === 'loading') {
    return <ThemedView style={{ flex: 1 }} />;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/calendario" />;
  }

  return <Redirect href="/(auth)/login" />;
}
