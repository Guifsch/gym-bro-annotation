import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useResolvedThemeName, useTheme } from '@/hooks/use-theme';

/**
 * Android's `elevation` shadow leaves a stale, unrounded rectangular outline behind after a
 * style-only re-render (e.g. toggling theme back and forth) — a known RN/Android limitation, not
 * something fixable by tweaking the shadow props. So Android always gets a border instead, same as
 * dark mode; only iOS (whose shadowPath-based shadow doesn't have this bug) gets the real shadow.
 */
const USE_BORDER_INSTEAD_OF_SHADOW = Platform.OS === 'android';

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  const isDark = useResolvedThemeName() === 'dark';
  const useBorder = isDark || USE_BORDER_INSTEAD_OF_SHADOW;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement },
        useBorder ? { borderWidth: 1, borderColor: theme.border } : CardShadow.light,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
});
