import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { Radius, Spacing, Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseQuickEntry } from '@/parser/quickEntryParser';

export type LogField = 'sets' | 'reps' | 'pesoKg';
export type LogFields = Partial<Record<LogField, number>>;

interface ExercicioEntryEditorProps {
  nome?: string;
  sets?: number;
  reps?: number;
  pesoKg?: number;
  onSaveFields: (fields: LogFields) => void;
}

export function ExercicioEntryEditor({ nome, sets, reps, pesoKg, onSaveFields }: ExercicioEntryEditorProps) {
  const theme = useTheme();
  const [setsText, setSetsText] = useState(sets !== undefined ? String(sets) : '');
  const [repsText, setRepsText] = useState(reps !== undefined ? String(reps) : '');
  const [pesoText, setPesoText] = useState(pesoKg !== undefined ? String(pesoKg) : '');
  const [parserText, setParserText] = useState('');
  const [parserError, setParserError] = useState<string | null>(null);

  function parseFieldValue(field: LogField, rawValue: string): number | undefined {
    const trimmed = rawValue.trim();
    if (!trimmed) return undefined;
    const parsed = field === 'pesoKg' ? Number(trimmed.replace(',', '.')) : Math.round(Number(trimmed));
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  function handleManualSave() {
    const fields: LogFields = {};
    const parsedSets = parseFieldValue('sets', setsText);
    const parsedReps = parseFieldValue('reps', repsText);
    const parsedPeso = parseFieldValue('pesoKg', pesoText);
    if (parsedSets !== undefined) fields.sets = parsedSets;
    if (parsedReps !== undefined) fields.reps = parsedReps;
    if (parsedPeso !== undefined) fields.pesoKg = parsedPeso;

    if (Object.keys(fields).length === 0) return;

    onSaveFields(fields);
    showToast('Salvo');
  }

  function handleParserSubmit() {
    const parsed = parseQuickEntry(parserText);
    const fields: LogFields = {};
    if (parsed.sets !== undefined) fields.sets = parsed.sets;
    if (parsed.reps !== undefined) fields.reps = parsed.reps;
    if (parsed.pesoKg !== undefined) fields.pesoKg = parsed.pesoKg;

    if (Object.keys(fields).length === 0) {
      setParserError('Não entendi. Tente algo como "3s 10r 10k".');
      return;
    }

    setParserError(null);
    setParserText('');
    if (fields.sets !== undefined) setSetsText(String(fields.sets));
    if (fields.reps !== undefined) setRepsText(String(fields.reps));
    if (fields.pesoKg !== undefined) setPesoText(String(fields.pesoKg));
    onSaveFields(fields);
    showToast('Salvo');
  }

  const fieldStyle = [styles.fieldInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];

  return (
    <Card style={styles.container}>
      {nome && <ThemedText type="smallBold">{nome}</ThemedText>}

      <ThemedText type="small" themeColor="textSecondary">
        Atual: {sets ?? '—'}x{reps ?? '—'} · {pesoKg !== undefined ? `${pesoKg}kg` : '—'}
      </ThemedText>

      <View style={styles.fields}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Sets
          </ThemedText>
          <TextInput
            value={setsText}
            onChangeText={setSetsText}
            keyboardType="number-pad"
            maxLength={2}
            style={fieldStyle}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Reps
          </ThemedText>
          <TextInput
            value={repsText}
            onChangeText={setRepsText}
            keyboardType="number-pad"
            maxLength={3}
            style={fieldStyle}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Peso (kg)
          </ThemedText>
          <TextInput
            value={pesoText}
            onChangeText={setPesoText}
            keyboardType="decimal-pad"
            maxLength={7}
            style={fieldStyle}
          />
        </View>
      </View>

      <View style={styles.parserContainer}>
        <View style={styles.parserLabel}>
          <Ionicons name="flash-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Rápido
          </ThemedText>
        </View>
        <View style={styles.parserRow}>
          <TextInput
            value={parserText}
            onChangeText={setParserText}
            onSubmitEditing={handleParserSubmit}
            placeholder="ex: 3s 10r 10k"
            placeholderTextColor={theme.textSecondary}
            style={[fieldStyle, styles.parserInput]}
            returnKeyType="done"
            maxLength={50}
          />
          <Pressable onPress={handleParserSubmit} style={[styles.okButton, { backgroundColor: Brand.primary }]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </Pressable>
        </View>
        {parserError && <ThemedText style={styles.error}>{parserError}</ThemedText>}
      </View>

      <GradientButton title="Salvar" onPress={handleManualSave} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  fields: { flexDirection: 'row', gap: Spacing.two },
  field: { flex: 1, gap: Spacing.half },
  fieldInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
    textAlign: 'center',
  },
  parserContainer: { gap: Spacing.one },
  parserLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  parserRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  parserInput: { flex: 1, textAlign: 'left' },
  okButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#e53935' },
});
