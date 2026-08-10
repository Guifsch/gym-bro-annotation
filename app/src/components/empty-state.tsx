import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onAction ? <GradientButton title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  title: { textAlign: 'center' },
});
