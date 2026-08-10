/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreferenceStore, type ThemeName } from '@/hooks/useThemePreference';

export function useResolvedThemeName(): ThemeName {
  const scheme = useColorScheme();
  const override = useThemePreferenceStore((s) => s.override);
  if (override) return override;
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const theme = useResolvedThemeName();
  return Colors[theme];
}
