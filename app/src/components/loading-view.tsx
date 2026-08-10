import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';

interface LoadingViewProps {
  label?: string;
}

/** Centered, full-screen loading state — a softly pulsing badge instead of a bare top-of-screen spinner/text. */
export function LoadingView({ label = 'Carregando...' }: LoadingViewProps) {
  const pulse = useSharedValue(0.9);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.badge, animatedStyle]}>
        <ActivityIndicator color={Brand.primary} size="large" />
      </Animated.View>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  badge: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 181, 128, 0.12)',
  },
});
