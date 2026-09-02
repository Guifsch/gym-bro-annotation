import { StyleSheet, TextInput } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface HeaderSearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Drop into `BackHeader`'s `titleSlot` while a search is active — same size/weight as the header
 * title (`ThemedText type="subtitle"`) it temporarily replaces, so the swap looks seamless. */
export function HeaderSearchField({ value, onChangeText, placeholder = 'Buscar...' }: HeaderSearchFieldProps) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      autoFocus
      style={[styles.input, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: FontFamily.bold, fontSize: 28, padding: 0 },
});
