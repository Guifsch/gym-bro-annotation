import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showToast } from '@/components/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseQuickEntry } from '@/parser/quickEntryParser';
import type { LogField, LogFields } from '@/types/workout';

interface InlineLogEditorProps {
  sets: number;
  reps: number;
  pesoKg: number;
  onSaveFields: (fields: LogFields) => void;
}

function parseFieldValue(field: LogField, rawValue: string): number | undefined {
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  const parsed = field === 'pesoKg' ? Number(trimmed.replace(',', '.')) : Math.round(Number(trimmed));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/** Compact inline editor for a list row: small Sets/Reps/Peso fields plus the "Modo rápido"
 * parser text field below them, without a big labeled-field card or an "Atual: ..." line (too
 * heavy to repeat per row in a list).
 *
 * Neither group has a save button — both auto-commit whatever was typed when the field loses
 * focus (tap elsewhere), the app is backgrounded, or this row unmounts (navigating away). Only
 * fields the user actually touched are sent, so tabbing through without editing never fires a
 * no-op save. */
export function InlineLogEditor({ sets, reps, pesoKg, onSaveFields }: InlineLogEditorProps) {
  const theme = useTheme();
  const [setsText, setSetsText] = useState(String(sets));
  const [repsText, setRepsText] = useState(String(reps));
  const [pesoText, setPesoText] = useState(String(pesoKg));
  const [quickText, setQuickText] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);

  const dirty = useRef({ sets: false, reps: false, pesoKg: false });
  const latest = useRef({ setsText, repsText, pesoText, quickText });
  useEffect(() => {
    latest.current = { setsText, repsText, pesoText, quickText };
  });

  function commitManual() {
    const { setsText: s, repsText: r, pesoText: p } = latest.current;
    const fields: LogFields = {};
    if (dirty.current.sets) {
      const value = parseFieldValue('sets', s);
      if (value !== undefined) fields.sets = value;
    }
    if (dirty.current.reps) {
      const value = parseFieldValue('reps', r);
      if (value !== undefined) fields.reps = value;
    }
    if (dirty.current.pesoKg) {
      const value = parseFieldValue('pesoKg', p);
      if (value !== undefined) fields.pesoKg = value;
    }
    dirty.current = { sets: false, reps: false, pesoKg: false };
    if (Object.keys(fields).length === 0) return;
    onSaveFields(fields);
    showToast('Salvo');
  }

  function commitQuick() {
    const currentText = latest.current.quickText;
    if (!currentText.trim()) return;

    const parsed = parseQuickEntry(currentText);
    const fields: LogFields = {};
    if (parsed.sets !== undefined) fields.sets = parsed.sets;
    if (parsed.reps !== undefined) fields.reps = parsed.reps;
    if (parsed.pesoKg !== undefined) fields.pesoKg = parsed.pesoKg;

    if (Object.keys(fields).length === 0) {
      setQuickError('Não entendi. Tente algo como "3s 10r 10k".');
      return;
    }

    setQuickError(null);
    setQuickText('');
    if (fields.sets !== undefined) setSetsText(String(fields.sets));
    if (fields.reps !== undefined) setRepsText(String(fields.reps));
    if (fields.pesoKg !== undefined) setPesoText(String(fields.pesoKg));
    onSaveFields(fields);
    showToast('Salvo');
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      commitManual();
      commitQuick();
    });
    return () => {
      subscription.remove();
      commitManual();
      commitQuick();
    };
    // Runs once on mount/unmount only — commitManual/commitQuick always read the latest values
    // via the `latest` ref, so they don't need to be in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldStyle = [styles.fieldInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];

  return (
    <View style={styles.container}>
      <View style={styles.manualRow}>
        <View style={styles.manualField}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.manualLabel}>
            Sets
          </ThemedText>
          <TextInput
            value={setsText}
            onChangeText={(t) => {
              setSetsText(t);
              dirty.current.sets = true;
            }}
            onBlur={commitManual}
            keyboardType="number-pad"
            maxLength={2}
            style={fieldStyle}
          />
        </View>
        <View style={styles.manualField}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.manualLabel}>
            Reps
          </ThemedText>
          <TextInput
            value={repsText}
            onChangeText={(t) => {
              setRepsText(t);
              dirty.current.reps = true;
            }}
            onBlur={commitManual}
            keyboardType="number-pad"
            maxLength={3}
            style={fieldStyle}
          />
        </View>
        <View style={styles.manualField}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.manualLabel}>
            Kg
          </ThemedText>
          <TextInput
            value={pesoText}
            onChangeText={(t) => {
              setPesoText(t);
              dirty.current.pesoKg = true;
            }}
            onBlur={commitManual}
            keyboardType="decimal-pad"
            maxLength={7}
            style={fieldStyle}
          />
        </View>
      </View>

      <View style={styles.quickRow}>
        <Ionicons name="flash-outline" size={14} color={theme.textSecondary} />
        <TextInput
          value={quickText}
          onChangeText={setQuickText}
          onBlur={commitQuick}
          onSubmitEditing={commitQuick}
          placeholder="ex: 3s 10r 10k"
          placeholderTextColor={theme.textSecondary}
          style={[fieldStyle, styles.quickInput]}
          returnKeyType="done"
          maxLength={50}
        />
      </View>
      {quickError && <ThemedText style={styles.error}>{quickError}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  manualRow: { flexDirection: 'row', gap: Spacing.one },
  manualField: { flex: 1, gap: 2 },
  manualLabel: { fontSize: 11, lineHeight: 14 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  fieldInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    fontSize: 13,
    textAlign: 'center',
  },
  quickInput: { flex: 1, textAlign: 'left' },
  error: { color: '#e53935' },
});
