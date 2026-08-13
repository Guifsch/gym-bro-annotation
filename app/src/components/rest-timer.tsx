import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Vibration, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimer() {
  const theme = useTheme();
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(30);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [vibrarAtivo, setVibrarAtivo] = useState(true);
  const [somAtivo, setSomAtivo] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  // Absolute end timestamp, not a tick counter — JS timers get throttled/paused while the app is
  // backgrounded, so counting down via fixed decrements per tick drifts behind real elapsed time.
  const endTimeRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  const tick = useCallback(() => {
    if (endTimeRef.current === null) return;
    const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setRemaining(secsLeft);
    if (secsLeft <= 0) {
      stopInterval();
      setRunning(false);
      endTimeRef.current = null;
      notificationIdRef.current = null;
    }
    return secsLeft;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && running) tick();
    });
    return () => subscription.remove();
  }, [running, tick]);

  async function cancelScheduledNotification() {
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
  }

  async function handlePlay() {
    const startFrom = remaining ?? minutes * 60 + seconds;
    if (startFrom <= 0) return;

    await Notifications.requestPermissionsAsync();

    endTimeRef.current = Date.now() + startFrom * 1000;
    setRemaining(startFrom);
    setRunning(true);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Descanso finalizado!',
        sound: somAtivo ? 'default' : undefined,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: startFrom, repeats: false },
    });
    notificationIdRef.current = id;

    intervalRef.current = setInterval(() => {
      const secsLeft = tick();
      if (secsLeft === 0 && vibrarAtivo) Vibration.vibrate(500);
    }, 1000);
  }

  function handlePause() {
    stopInterval();
    setRunning(false);
    void cancelScheduledNotification();
  }

  function handleReset() {
    stopInterval();
    setRunning(false);
    setRemaining(null);
    endTimeRef.current = null;
    void cancelScheduledNotification();
  }

  const displaySeconds = remaining ?? minutes * 60 + seconds;

  return (
    <Card style={styles.container}>
      <ThemedText type="smallBold">Timer de descanso</ThemedText>

      {remaining === null && !running ? (
        <View style={styles.stepperRow}>
          <View style={styles.stepperGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Min
            </ThemedText>
            <View style={styles.stepper}>
              <Pressable onPress={() => setMinutes((m) => Math.max(0, m - 1))} style={styles.stepperButton}>
                <Ionicons name="remove" size={18} color={theme.text} />
              </Pressable>
              <ThemedText type="smallBold">{minutes}</ThemedText>
              <Pressable onPress={() => setMinutes((m) => Math.min(59, m + 1))} style={styles.stepperButton}>
                <Ionicons name="add" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>
          <View style={styles.stepperGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Seg
            </ThemedText>
            <View style={styles.stepper}>
              <Pressable onPress={() => setSeconds((s) => Math.max(0, s - 15))} style={styles.stepperButton}>
                <Ionicons name="remove" size={18} color={theme.text} />
              </Pressable>
              <ThemedText type="smallBold">{seconds}</ThemedText>
              <Pressable onPress={() => setSeconds((s) => Math.min(45, s + 15))} style={styles.stepperButton}>
                <Ionicons name="add" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <ThemedText style={styles.countdown}>{formatSeconds(displaySeconds)}</ThemedText>
      )}

      <View style={styles.controlsRow}>
        <Pressable
          onPress={running ? handlePause : handlePlay}
          style={[styles.playButton, { backgroundColor: Brand.primary }]}>
          <Ionicons name={running ? 'pause' : 'play'} size={22} color="#fff" />
        </Pressable>
        {remaining !== null && (
          <Pressable onPress={handleReset} style={[styles.resetButton, { borderColor: theme.border }]}>
            <Ionicons name="refresh" size={18} color={theme.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchItem}>
          <ThemedText type="small">Vibrar</ThemedText>
          <Switch value={vibrarAtivo} onValueChange={setVibrarAtivo} trackColor={{ true: Brand.primary }} />
        </View>
        <View style={styles.switchItem}>
          <ThemedText type="small">Som</ThemedText>
          <Switch value={somAtivo} onValueChange={setSomAtivo} trackColor={{ true: Brand.primary }} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, alignItems: 'center' },
  stepperRow: { flexDirection: 'row', gap: Spacing.five },
  stepperGroup: { alignItems: 'center', gap: Spacing.one },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperButton: { padding: Spacing.one },
  countdown: { fontSize: 40, lineHeight: 52, fontWeight: '700' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', gap: Spacing.five },
  switchItem: { alignItems: 'center', gap: Spacing.one },
});
