import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { AuthBadge } from '@/components/auth-badge';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

interface LoadingViewProps {
  label?: string;
}

/** Centered, full-screen loading state — the app's own logo pulsing on a softly branded background. */
export function LoadingView({ label = 'Carregando...' }: LoadingViewProps) {
  const pulse = useSharedValue(0.94);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
        <AuthBadge />
      </Animated.View>
      {label ? (
        <View style={styles.labelRow}>
          <ActivityIndicator color={Brand.primary} size="small" />
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    backgroundColor: 'rgba(21, 181, 128, 0.06)',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
