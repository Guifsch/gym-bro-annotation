import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { getApiErrorMessage } from '@/api/apiClient';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTimerStore } from '@/stores/timerStore';
import type { TimerPreset } from '@/types/workout';
import { formatSeconds } from '@/utils/time';

export function RestTimer() {
  const theme = useTheme();
  const minutes = useTimerStore((s) => s.minutes);
  const seconds = useTimerStore((s) => s.seconds);
  const presets = useTimerStore((s) => s.presets);
  const savingPreset = useTimerStore((s) => s.savingPreset);
  const remaining = useTimerStore((s) => s.remaining);
  const running = useTimerStore((s) => s.running);
  const starting = useTimerStore((s) => s.starting);
  const alarming = useTimerStore((s) => s.alarming);
  const vibrarAtivo = useTimerStore((s) => s.vibrarAtivo);
  const somAtivo = useTimerStore((s) => s.somAtivo);
  const setMinutes = useTimerStore((s) => s.setMinutes);
  const setSeconds = useTimerStore((s) => s.setSeconds);
  const selectPreset = useTimerStore((s) => s.selectPreset);
  const saveCurrentAsPreset = useTimerStore((s) => s.saveCurrentAsPreset);
  const deletePreset = useTimerStore((s) => s.deletePreset);
  const setVibrarAtivo = useTimerStore((s) => s.setVibrarAtivo);
  const setSomAtivo = useTimerStore((s) => s.setSomAtivo);
  const handlePlay = useTimerStore((s) => s.handlePlay);
  const handlePause = useTimerStore((s) => s.handlePause);
  const handleReset = useTimerStore((s) => s.handleReset);
  const stopAlarm = useTimerStore((s) => s.stopAlarm);
  const addOneMinute = useTimerStore((s) => s.addOneMinute);

  async function handleSavePreset() {
    try {
      await saveCurrentAsPreset();
    } catch (err) {
      Alert.alert('Não foi possível salvar', getApiErrorMessage(err, 'Tente novamente em instantes.'));
    }
  }

  function confirmDeletePreset(preset: TimerPreset) {
    Alert.alert('Excluir este timer?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deletePreset(preset) },
    ]);
  }

  const displaySeconds = remaining ?? minutes * 60 + seconds;

  return (
    <Card style={styles.container}>
      <ThemedText type="smallBold">Timer de descanso</ThemedText>

      {remaining === null && !running && !alarming ? (
        <>
          <View style={styles.stepperRow}>
            <View style={styles.stepperGroup}>
              <ThemedText themeColor="textSecondary">Min</ThemedText>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setMinutes((m) => Math.max(0, m - 1))}
                  style={[styles.stepperButton, { borderColor: theme.border }]}>
                  <Ionicons name="remove" size={20} color={theme.text} />
                </Pressable>
                <ThemedText style={styles.stepperValue}>{minutes}</ThemedText>
                <Pressable
                  onPress={() => setMinutes((m) => Math.min(59, m + 1))}
                  style={[styles.stepperButton, { borderColor: theme.border }]}>
                  <Ionicons name="add" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>
            <View style={styles.stepperGroup}>
              <ThemedText themeColor="textSecondary">Seg</ThemedText>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setSeconds((s) => Math.max(0, s - 15))}
                  style={[styles.stepperButton, { borderColor: theme.border }]}>
                  <Ionicons name="remove" size={20} color={theme.text} />
                </Pressable>
                <ThemedText style={styles.stepperValue}>{seconds}</ThemedText>
                <Pressable
                  onPress={() => setSeconds((s) => Math.min(45, s + 15))}
                  style={[styles.stepperButton, { borderColor: theme.border }]}>
                  <Ionicons name="add" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.presetRow}>
            {presets.map((preset) => (
              <View key={preset._id} style={styles.presetChipWrap}>
                <Pressable
                  onPress={() => selectPreset(preset)}
                  style={[
                    styles.presetChip,
                    { borderColor: theme.border },
                    minutes * 60 + seconds === preset.seconds && { borderColor: Brand.primary, backgroundColor: 'rgba(21, 181, 128, 0.12)' },
                  ]}>
                  <ThemedText>{formatSeconds(preset.seconds)}</ThemedText>
                </Pressable>
                <Pressable onPress={() => confirmDeletePreset(preset)} hitSlop={10} style={styles.presetDeleteBadge}>
                  <Ionicons name="close" size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={handleSavePreset}
              disabled={savingPreset}
              style={[styles.presetChip, styles.presetAddChip, { borderColor: theme.border }, savingPreset && styles.playButtonDisabled]}>
              <Ionicons name="add" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </>
      ) : (
        <ThemedText style={[styles.countdown, alarming && { color: Brand.accent }]}>
          {alarming ? 'Concluído!' : formatSeconds(displaySeconds)}
        </ThemedText>
      )}

      {alarming ? (
        <View style={styles.controlsRow}>
          <GradientButton title="+1 min" onPress={addOneMinute} icon={<Ionicons name="add" size={18} color="#fff" />} />
          <Pressable onPress={stopAlarm} style={[styles.resetButton, { borderColor: theme.border }]}>
            <Ionicons name="pause" size={20} color={theme.text} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.controlsRow}>
          <Pressable
            onPress={running ? handlePause : handlePlay}
            disabled={starting && !running}
            style={[styles.playButton, { backgroundColor: Brand.primary }, starting && !running && styles.playButtonDisabled]}>
            <Ionicons name={running ? 'pause' : 'play'} size={26} color="#fff" />
          </Pressable>
          {running && (
            <Pressable onPress={addOneMinute} style={[styles.resetButton, { borderColor: theme.border }]}>
              <Ionicons name="add" size={20} color={theme.text} />
            </Pressable>
          )}
          {remaining !== null && (
            <Pressable onPress={handleReset} style={[styles.resetButton, { borderColor: theme.border }]}>
              <Ionicons name="refresh" size={20} color={theme.text} />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchItem}>
          <ThemedText>Vibrar</ThemedText>
          <Switch value={vibrarAtivo} onValueChange={setVibrarAtivo} trackColor={{ true: Brand.primary }} />
        </View>
        <View style={styles.switchItem}>
          <ThemedText>Som</ThemedText>
          <Switch value={somAtivo} onValueChange={setSomAtivo} trackColor={{ true: Brand.primary }} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four, alignItems: 'center' },
  stepperRow: { flexDirection: 'row', gap: Spacing.five },
  stepperGroup: { alignItems: 'center', gap: Spacing.two },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', minWidth: 32, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two },
  presetChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  presetAddChip: { paddingHorizontal: Spacing.two },
  presetChipWrap: { position: 'relative' },
  presetDeleteBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: { fontSize: 46, lineHeight: 58, fontWeight: '700' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: { opacity: 0.5 },
  resetButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', gap: Spacing.five },
  switchItem: { alignItems: 'center', gap: Spacing.two },
});
