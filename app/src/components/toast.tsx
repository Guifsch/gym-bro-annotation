import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';

export type ToastType = 'success' | 'error';

interface ToastState {
  message: string;
  type: ToastType;
}

let currentToast: ToastState | null = null;
let listeners: ((toast: ToastState | null) => void)[] = [];
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget feedback bubble ("Salvo", "Excluído", ...) — rendered once via <ToastHost /> at the app root. */
export function showToast(message: string, type: ToastType = 'success'): void {
  currentToast = { message, type };
  for (const listener of listeners) listener(currentToast);

  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    currentToast = null;
    for (const listener of listeners) listener(null);
  }, 2000);
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(currentToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listeners.push(setToast);
    return () => {
      listeners = listeners.filter((l) => l !== setToast);
    };
  }, []);

  if (!toast) return null;

  const backgroundColor = toast.type === 'error' ? '#e53935' : Brand.primary;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: insets.top + Spacing.two }]}
      pointerEvents="none">
      <View style={[styles.bubble, { backgroundColor }]}>
        <ThemedText style={styles.text}>{toast.message}</ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bubble: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  text: { color: '#fff', fontWeight: '600' },
});
