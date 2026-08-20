import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { LogFields } from '@/components/exercicio-entry-editor';
import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseQuickEntry } from '@/parser/quickEntryParser';

interface QuickEntryInlineProps {
  onSaveFields: (fields: LogFields) => void;
}

/** Lean "Modo rápido" input for inline use below a list row — just the parser text field,
 * confirm button and error text, without ExercicioEntryEditor's manual Sets/Reps/Peso
 * fields and "Atual: ..." line (too heavy to repeat per row in a list). */
export function QuickEntryInline({ onSaveFields }: QuickEntryInlineProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const parsed = parseQuickEntry(text);
    const fields: LogFields = {};
    if (parsed.sets !== undefined) fields.sets = parsed.sets;
    if (parsed.reps !== undefined) fields.reps = parsed.reps;
    if (parsed.pesoKg !== undefined) fields.pesoKg = parsed.pesoKg;

    if (Object.keys(fields).length === 0) {
      setError('Não entendi. Tente algo como "3s 10r 10k".');
      return;
    }

    setError(null);
    setText('');
    onSaveFields(fields);
    showToast('Salvo');
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="flash-outline" size={14} color={theme.textSecondary} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          placeholder="ex: 3s 10r 10k"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          returnKeyType="done"
          maxLength={50}
        />
        <Pressable onPress={handleSubmit} style={[styles.okButton, { backgroundColor: Brand.primary }]}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </Pressable>
      </View>
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.half },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
  },
  okButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#e53935' },
});
