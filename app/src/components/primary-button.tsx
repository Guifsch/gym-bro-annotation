import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ title, onPress, loading, disabled }: PrimaryButtonProps) {
  const isDisabled = Boolean(loading) || Boolean(disabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, isDisabled && styles.disabled, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.label}>{title}</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#15b580',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  label: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
