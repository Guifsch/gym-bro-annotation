import { Redirect } from 'expo-router';
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

  if (status === 'idle' || status === 'loading') {
    return <ThemedView style={{ flex: 1 }} />;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/treinos" />;
  }

  return <Redirect href="/(auth)/login" />;
}
