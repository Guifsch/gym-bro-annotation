import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface LabeledTextFieldProps extends TextInputProps {
  label?: string;
  onClear?: () => void;
}

export function LabeledTextField({ label, style, onFocus, onBlur, onClear, value, ...rest }: LabeledTextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const showClearButton = Boolean(onClear) && Boolean(value);

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="small">{label}</ThemedText> : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
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
            showClearButton && styles.inputWithClear,
            style,
          ]}
          {...rest}
        />
        {showClearButton && (
          <Pressable onPress={onClear} hitSlop={8} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputFocused: { borderWidth: 2 },
  inputWithClear: { paddingRight: 40 },
  clearButton: { position: 'absolute', right: Spacing.two },
});
