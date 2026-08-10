import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
}

export function BackHeader({ title, subtitle }: BackHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="chevron-back" size={20} color={theme.text} />
      </Pressable>
      <View style={styles.textCol}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
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
  textCol: { flex: 1, gap: 2 },
});
