import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Replaces the title/subtitle text with custom content (e.g. an inline search field) while
   * keeping the back button and `rightActions` in place. */
  titleSlot?: ReactNode;
  /** Trailing icon buttons, vertically centered with the back button. */
  rightActions?: ReactNode;
}

export function BackHeader({ title, subtitle, onBack, titleSlot, rightActions }: BackHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="chevron-back" size={20} color={theme.text} />
      </Pressable>
      <View style={styles.textCol}>
        {titleSlot ?? (
          <>
            <ThemedText type="subtitle" numberOfLines={2}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
      {rightActions}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 1 },
});
