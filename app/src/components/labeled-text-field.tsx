import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface LabeledTextFieldProps extends TextInputProps {
  label?: string;
}

export function LabeledTextField({ label, style, onFocus, onBlur, ...rest }: LabeledTextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="small">{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: focused ? Brand.primary : theme.border,
            backgroundColor: theme.backgroundElement,
          },
          focused && styles.inputFocused,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputFocused: { borderWidth: 2 },
});
