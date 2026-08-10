import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

let currentMessage: string | null = null;
let listeners: ((message: string | null) => void)[] = [];
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget feedback bubble ("Salvo", "Excluído", ...) — rendered once via <ToastHost /> at the app root. */
export function showToast(message: string): void {
  currentMessage = message;
  for (const listener of listeners) listener(message);

  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    currentMessage = null;
    for (const listener of listeners) listener(null);
  }, 2000);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(currentMessage);

  useEffect(() => {
    listeners.push(setMessage);
    return () => {
      listeners = listeners.filter((l) => l !== setMessage);
    };
  }, []);

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}
      pointerEvents="none">
      <View style={styles.bubble}>
        <ThemedText style={styles.text}>{message}</ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.six,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  text: { color: '#fff', fontWeight: '600' },
});
