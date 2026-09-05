import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTimerStore } from '@/stores/timerStore';
import { formatSeconds } from '@/utils/time';

interface MicroStepperProps {
  value: number;
  step: number;
  max: number;
  onChange: (updater: (v: number) => number) => void;
}

function MicroStepper({ value, step, max, onChange }: MicroStepperProps) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange((v) => Math.max(0, v - step))} hitSlop={6} style={styles.stepperButton}>
        <Ionicons name="remove" size={13} color="#fff" />
      </Pressable>
      <ThemedText style={styles.stepperValue}>{String(value).padStart(2, '0')}</ThemedText>
      <Pressable onPress={() => onChange((v) => Math.min(max, v + step))} hitSlop={6} style={styles.stepperButton}>
        <Ionicons name="add" size={13} color="#fff" />
      </Pressable>
    </View>
  );
}

/** Compact "mini-player"-style bar, glued directly above the tab bar and visible on every tab
 * screen — mounted once in `(tabs)/_layout.tsx` alongside the Tabs navigator, not per-screen, so
 * it survives navigation exactly like the tab bar itself. Mirrors the same shared `useTimerStore`
 * state as the full `RestTimer` on the Timer tab, so starting/pausing/resetting from either place
 * stays in sync. */
export function MiniTimerBar() {
  const minutes = useTimerStore((s) => s.minutes);
  const seconds = useTimerStore((s) => s.seconds);
  const remaining = useTimerStore((s) => s.remaining);
  const running = useTimerStore((s) => s.running);
  const alarming = useTimerStore((s) => s.alarming);
  const setMinutes = useTimerStore((s) => s.setMinutes);
  const setSeconds = useTimerStore((s) => s.setSeconds);
  const handlePlay = useTimerStore((s) => s.handlePlay);
  const handlePause = useTimerStore((s) => s.handlePause);
  const handleReset = useTimerStore((s) => s.handleReset);
  const stopAlarm = useTimerStore((s) => s.stopAlarm);
  const addOneMinute = useTimerStore((s) => s.addOneMinute);

  const isIdle = remaining === null && !running && !alarming;
  const displaySeconds = remaining ?? minutes * 60 + seconds;

  return (
    <View style={styles.bar}>
      <View style={styles.sideLeft}>
        <Pressable onPress={() => router.push('/(tabs)/extras/timer')} hitSlop={8} style={styles.iconButton}>
          <Ionicons name="timer-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.center}>
        {isIdle ? (
          <View style={styles.editGroup}>
            <MicroStepper value={minutes} step={1} max={59} onChange={setMinutes} />
            <ThemedText style={styles.colon}>:</ThemedText>
            <MicroStepper value={seconds} step={15} max={45} onChange={setSeconds} />
          </View>
        ) : (
          <ThemedText style={styles.time} numberOfLines={1}>
            {alarming ? 'Concluído!' : formatSeconds(displaySeconds)}
          </ThemedText>
        )}
      </View>

      <View style={styles.sideRight}>
        {alarming ? (
          <View style={styles.controls}>
            <Pressable onPress={addOneMinute} style={styles.controlButton}>
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={stopAlarm} style={styles.controlButton}>
              <Ionicons name="pause" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable onPress={running ? handlePause : handlePlay} style={styles.controlButton}>
              <Ionicons name={running ? 'pause' : 'play'} size={18} color="#fff" />
            </Pressable>
            {remaining !== null && (
              <Pressable onPress={handleReset} style={styles.controlButton}>
                <Ionicons name="refresh" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export const MINI_TIMER_BAR_HEIGHT = 48;

// Both side columns share this width so the center column (minute/second controls or the
// countdown) sits mathematically centered in the bar, regardless of the icon button's width or
// how many buttons are showing on the right (1 when idle/paused, 2 when running or alarming).
const SIDE_WIDTH = 76;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MINI_TIMER_BAR_HEIGHT,
    paddingHorizontal: Spacing.three,
    backgroundColor: Brand.primary,
  },
  sideLeft: { width: SIDE_WIDTH, alignItems: 'flex-start' },
  sideRight: { width: SIDE_WIDTH, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  iconButton: { padding: Spacing.one },
  editGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stepperButton: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { color: '#fff', fontWeight: '700', minWidth: 22, textAlign: 'center' },
  colon: { color: '#fff', fontWeight: '700' },
  time: { color: '#fff', fontWeight: '700', fontSize: 18, minWidth: 64, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
