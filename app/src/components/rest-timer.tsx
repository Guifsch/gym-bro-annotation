import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Switch, View } from 'react-native';

import { createTimerPreset, deleteTimerPreset, listTimerPresets } from '@/api/workoutApi';
import { Card } from '@/components/card';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelTimerAlarm,
  scheduleTimerAlarm,
  setTimerAlarmListener,
  setTimerAlarmPrefs,
  SNOOZE_SECONDS,
} from '@/notifications/timerAlarmService';
import type { TimerPreset } from '@/types/workout';

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimer() {
  const theme = useTheme();
  const [minutes, setMinutes] = useState(2);
  const [seconds, setSeconds] = useState(0);
  const [presets, setPresets] = useState<TimerPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [alarming, setAlarming] = useState(false);
  const [vibrarAtivo, setVibrarAtivo] = useState(true);
  const [somAtivo, setSomAtivo] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Absolute end timestamp, not a tick counter — JS timers get throttled/paused while the app is
  // backgrounded, so counting down via fixed decrements per tick drifts behind real elapsed time.
  const endTimeRef = useRef<number | null>(null);
  // Bumped by any Play/Pause/Reset; an in-flight startCountdown checks this after each await and
  // bails out (cancelling whatever it already scheduled) if it's been superseded by a newer action —
  // otherwise rapid taps race and leave orphaned notifications scheduled behind the app's back.
  const generationRef = useRef(0);

  useEffect(() => {
    setTimerAlarmPrefs(vibrarAtivo, somAtivo);
  }, [vibrarAtivo, somAtivo]);

  // Presets belong to the account, not to any one exercise — every RestTimer instance (any exercise
  // visited through the calendar) fetches and shares the exact same list.
  useEffect(() => {
    listTimerPresets().then(setPresets);
  }, []);

  function selectPreset(preset: TimerPreset) {
    setMinutes(Math.floor(preset.seconds / 60));
    setSeconds(preset.seconds % 60);
  }

  async function saveCurrentAsPreset() {
    if (savingPreset) return; // guards against double-taps racing two creates for the same duration
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds <= 0 || presets.some((p) => p.seconds === totalSeconds)) return;

    setSavingPreset(true);
    try {
      const preset = await createTimerPreset({ id: Crypto.randomUUID(), seconds: totalSeconds });
      setPresets((prev) => {
        // The backend dedupes by (userId, seconds) on its own, but merge defensively by _id here too
        // in case a stale response for the same duration ever comes back with a different id.
        const withoutDuplicate = prev.filter((p) => p._id !== preset._id && p.seconds !== preset.seconds);
        return [...withoutDuplicate, preset].sort((a, b) => a.seconds - b.seconds);
      });
    } finally {
      setSavingPreset(false);
    }
  }

  function confirmDeletePreset(preset: TimerPreset) {
    Alert.alert('Excluir este timer?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteTimerPreset(preset._id);
          setPresets((prev) => prev.filter((p) => p._id !== preset._id));
        },
      },
    ]);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  const startCountdown = useCallback(async (startFrom: number) => {
    if (startFrom <= 0) return;
    const myGeneration = ++generationRef.current;
    setStarting(true);

    await scheduleTimerAlarm(startFrom);
    if (generationRef.current !== myGeneration) {
      // A Pause/Reset happened while this was scheduling — cancel what we just scheduled, nothing
      // else is tracking it.
      setStarting(false);
      void cancelTimerAlarm();
      return;
    }

    endTimeRef.current = Date.now() + startFrom * 1000;
    setRemaining(startFrom);
    setRunning(true);
    setStarting(false);
    setAlarming(false);

    stopInterval();
    intervalRef.current = setInterval(() => {
      if (endTimeRef.current === null) return;
      const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(secsLeft);
      if (secsLeft <= 0) {
        stopInterval();
        setRunning(false);
        setAlarming(true);
        endTimeRef.current = null;
      }
    }, 1000);
  }, []);

  const handlePlay = useCallback(() => {
    void startCountdown(remaining ?? minutes * 60 + seconds);
  }, [startCountdown, remaining, minutes, seconds]);

  const stopAlarm = useCallback(() => {
    generationRef.current++; // invalidate an in-flight snooze (+1 min) restart, if any
    setAlarming(false);
    setRemaining(null);
    void cancelTimerAlarm();
  }, []);

  const addOneMinute = useCallback(() => {
    if (alarming) {
      void startCountdown(SNOOZE_SECONDS);
      return;
    }
    if (running && endTimeRef.current !== null) {
      endTimeRef.current += SNOOZE_SECONDS * 1000;
      const secsLeft = Math.max(1, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(secsLeft);
      void scheduleTimerAlarm(secsLeft);
    }
  }, [alarming, running, startCountdown]);

  // Syncs the on-screen state whenever the alarm notification's own action buttons are used — those
  // reach this listener whenever the app's JS is alive (foreground, or woken from background), but
  // not from a fully killed app; the alarm itself (vibration/sound) still stops correctly either way,
  // since that's handled by the foreground service regardless of whether anything is listening here.
  useEffect(() => {
    setTimerAlarmListener((action) => {
      if (action === 'pause') {
        setAlarming(false);
        setRemaining(null);
        stopInterval();
        setRunning(false);
      } else if (action === 'snooze') {
        endTimeRef.current = Date.now() + SNOOZE_SECONDS * 1000;
        setRemaining(SNOOZE_SECONDS);
        setAlarming(false);
        setRunning(true);
        stopInterval();
        intervalRef.current = setInterval(() => {
          if (endTimeRef.current === null) return;
          const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          setRemaining(secsLeft);
          if (secsLeft <= 0) {
            stopInterval();
            setRunning(false);
            setAlarming(true);
            endTimeRef.current = null;
          }
        }, 1000);
      }
    });
    return () => setTimerAlarmListener(null);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || endTimeRef.current === null || !running) return;
      const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(secsLeft);
      if (secsLeft <= 0) {
        stopInterval();
        setRunning(false);
        setAlarming(true);
        endTimeRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [running]);

  function handlePause() {
    generationRef.current++; // invalidate any startCountdown still mid-flight
    stopInterval();
    setRunning(false);
    void cancelTimerAlarm();
  }

  function handleReset() {
    generationRef.current++;
    stopInterval();
    setRunning(false);
    setAlarming(false);
    setRemaining(null);
    endTimeRef.current = null;
    void cancelTimerAlarm();
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
              onPress={saveCurrentAsPreset}
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
