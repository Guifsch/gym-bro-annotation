import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Brand, FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Each Poppins weight is its own font file/family (not a variable font RN can re-weight on the
// fly), so `fontFamily` picks the weight here directly instead of pairing a base family with
// `fontWeight` — a `fontWeight` override layered on top from a caller's own `style` prop won't
// reliably re-weight these, especially on Android.
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.medium,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.bold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FontFamily.medium,
  },
  title: {
    fontFamily: FontFamily.extrabold,
    fontSize: 44,
    lineHeight: 48,
  },
  subtitle: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    color: Brand.primary,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
