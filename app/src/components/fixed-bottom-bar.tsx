import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Docks its children (typically a single `GradientButton`) flush above the tab bar — same
 * "floating save button" pattern the old workout timer used. Screens nested inside `(tabs)` get
 * laid out with the tab bar as a sibling, not an overlay, so `position:'absolute', bottom:0` here
 * lands exactly above it with no extra safe-area math needed. The screen's scrollable content
 * needs its own bottom padding (see `FIXED_BOTTOM_BAR_SPACE`) so the last item isn't hidden behind
 * this bar.
 */
export function FixedBottomBar({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border }, style]}
      {...rest}
    />
  );
}

/** Reserve this much bottom padding on a screen's scrollable content when it also renders a
 * `FixedBottomBar`, so the bar never overlaps the last item. */
export const FIXED_BOTTOM_BAR_SPACE = 100;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
