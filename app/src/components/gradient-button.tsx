import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export function GradientButton({ title, onPress, loading, disabled, icon }: GradientButtonProps) {
  const isDisabled = Boolean(loading) || Boolean(disabled);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated via .value by design, not React state
          scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated via .value by design, not React state
          scale.value = withSpring(1, { damping: 15 });
        }}
        style={isDisabled ? styles.disabled : undefined}>
        <LinearGradient
          colors={[Brand.primary, Brand.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {icon}
              <ThemedText style={styles.label}>{title}</ThemedText>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  disabled: { opacity: 0.6 },
  label: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
