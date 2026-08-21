import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { createTimerPreset, deleteTimerPreset, listTimerPresets } from '@/api/workoutApi';
import {
  cancelRunningNotification,
  cancelTimerAlarm,
  scheduleTimerAlarm,
  setTimerAlarmListener,
  setTimerAlarmPrefs,
  SNOOZE_SECONDS,
} from '@/notifications/timerAlarmService';
import { readJson, writeJson } from '@/offline/storage';
import type { TimerPreset } from '@/types/workout';

const MINI_BAR_ENABLED_KEY = 'timer:miniBarEnabled';
const DEFAULT_PRESET_ID_KEY = 'timer:defaultPresetId';

interface TimerState {
  minutes: number;
  seconds: number;
  presets: TimerPreset[];
  savingPreset: boolean;
  remaining: number | null;
  running: boolean;
  starting: boolean;
  alarming: boolean;
  vibrarAtivo: boolean;
  somAtivo: boolean;
  miniBarEnabled: boolean;
  defaultPresetId: string | null;

  hydrate: () => Promise<void>;
  setMinutes: (updater: (m: number) => number) => void;
  setSeconds: (updater: (s: number) => number) => void;
  selectPreset: (preset: TimerPreset) => void;
  saveCurrentAsPreset: () => Promise<TimerPreset | null>;
  deletePreset: (preset: TimerPreset) => Promise<void>;
  setVibrarAtivo: (value: boolean) => void;
  setSomAtivo: (value: boolean) => void;
  setMiniBarEnabled: (enabled: boolean) => void;
  setDefaultPresetId: (id: string | null) => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleReset: () => void;
  stopAlarm: () => void;
  addOneMinute: () => void;
}

// Timer bookkeeping that isn't meant to be reactive UI state lives as module-scope singletons —
// the store itself is already a singleton (created once at import time), same pattern as the
// `listener`/`stopResolver` module vars in timerAlarmService.ts.
let intervalId: ReturnType<typeof setInterval> | null = null;
// Absolute end timestamp, not a tick counter — JS timers get throttled/paused while the app is
// backgrounded, so counting down via fixed decrements per tick drifts behind real elapsed time.
let endTime: number | null = null;
// Bumped by any Play/Pause/Reset; an in-flight startCountdown checks this after each await and
// bails out (cancelling whatever it already scheduled) if it's been superseded by a newer action —
// otherwise rapid taps race and leave orphaned notifications scheduled behind the app's back.
let generation = 0;

function stopInterval() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

function applyPresetIfIdle(get: () => TimerState, set: (partial: Partial<TimerState>) => void, presetId: string | null) {
  const { remaining, running, alarming, presets } = get();
  if (!presetId || remaining !== null || running || alarming) return;
  const preset = presets.find((p) => p._id === presetId);
  if (preset) set({ minutes: Math.floor(preset.seconds / 60), seconds: preset.seconds % 60 });
}

export const useTimerStore = create<TimerState>((set, get) => {
  function tick() {
    if (endTime === null) return;
    const secsLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    set({ remaining: secsLeft });
    if (secsLeft <= 0) {
      stopInterval();
      endTime = null;
      set({ running: false, alarming: true });
      // Safety net: if the OS-level alarm never actually fired (permission not granted, process
      // killed, etc.), the foreground service's own cleanup never ran either — without this, the
      // "still running" notification's native chronometer just keeps counting into negative
      // numbers forever since nothing else tells it to stop.
      void cancelRunningNotification();
    }
  }

  async function startCountdown(startFrom: number) {
    if (startFrom <= 0) return;
    const myGeneration = ++generation;
    set({ starting: true });

    await scheduleTimerAlarm(startFrom);
    if (generation !== myGeneration) {
      // A Pause/Reset happened while this was scheduling — cancel what we just scheduled, nothing
      // else is tracking it.
      set({ starting: false });
      void cancelTimerAlarm();
      return;
    }

    endTime = Date.now() + startFrom * 1000;
    set({ remaining: startFrom, running: true, starting: false, alarming: false });

    stopInterval();
    intervalId = setInterval(tick, 1000);
  }

  // Syncs state whenever the alarm notification's own action buttons are used — those reach this
  // listener whenever the app's JS is alive (foreground, or woken from background), but not from a
  // fully killed app; the alarm itself (vibration/sound) still stops correctly either way, since
  // that's handled by the foreground service regardless of whether anything is listening here.
  setTimerAlarmListener((action) => {
    if (action === 'pause') {
      stopInterval();
      endTime = null;
      set({ alarming: false, remaining: null, running: false });
    } else if (action === 'snooze') {
      endTime = Date.now() + SNOOZE_SECONDS * 1000;
      set({ remaining: SNOOZE_SECONDS, alarming: false, running: true });
      stopInterval();
      intervalId = setInterval(tick, 1000);
    }
  });

  // Registered once for the app's lifetime (this store is a singleton) instead of per mounted
  // screen, so the countdown keeps resyncing on foreground even while no timer UI is on screen.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    const { running } = get();
    if (endTime === null || !running) return;
    tick();
  });

  return {
    minutes: 2,
    seconds: 0,
    presets: [],
    savingPreset: false,
    remaining: null,
    running: false,
    starting: false,
    alarming: false,
    vibrarAtivo: true,
    somAtivo: true,
    miniBarEnabled: false,
    defaultPresetId: null,

    hydrate: async () => {
      const [presets, miniBarEnabled, defaultPresetId] = await Promise.all([
        listTimerPresets(),
        readJson(MINI_BAR_ENABLED_KEY, false),
        readJson<string | null>(DEFAULT_PRESET_ID_KEY, null),
      ]);
      set({ presets, miniBarEnabled, defaultPresetId });
      applyPresetIfIdle(get, set, defaultPresetId);
    },

    setMinutes: (updater) => set((s) => ({ minutes: updater(s.minutes) })),
    setSeconds: (updater) => set((s) => ({ seconds: updater(s.seconds) })),

    selectPreset: (preset) => set({ minutes: Math.floor(preset.seconds / 60), seconds: preset.seconds % 60 }),

    saveCurrentAsPreset: async () => {
      const { savingPreset, minutes, seconds, presets } = get();
      if (savingPreset) return null; // guards against double-taps racing two creates for the same duration
      const totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 0 || presets.some((p) => p.seconds === totalSeconds)) return null;

      set({ savingPreset: true });
      try {
        const preset = await createTimerPreset({ id: Crypto.randomUUID(), seconds: totalSeconds });
        set((s) => {
          // The backend dedupes by (userId, seconds) on its own, but merge defensively by _id here
          // too in case a stale response for the same duration ever comes back with a different id.
          const withoutDuplicate = s.presets.filter((p) => p._id !== preset._id && p.seconds !== preset.seconds);
          return { presets: [...withoutDuplicate, preset].sort((a, b) => a.seconds - b.seconds) };
        });
        return preset;
      } finally {
        set({ savingPreset: false });
      }
    },

    deletePreset: async (preset) => {
      await deleteTimerPreset(preset._id);
      set((s) => ({ presets: s.presets.filter((p) => p._id !== preset._id) }));
      if (get().defaultPresetId === preset._id) {
        get().setDefaultPresetId(null);
      }
    },

    setVibrarAtivo: (value) => {
      set({ vibrarAtivo: value });
      setTimerAlarmPrefs(value, get().somAtivo);
    },
    setSomAtivo: (value) => {
      set({ somAtivo: value });
      setTimerAlarmPrefs(get().vibrarAtivo, value);
    },

    setMiniBarEnabled: (enabled) => {
      set({ miniBarEnabled: enabled });
      void writeJson(MINI_BAR_ENABLED_KEY, enabled);
    },

    setDefaultPresetId: (id) => {
      set({ defaultPresetId: id });
      void writeJson(DEFAULT_PRESET_ID_KEY, id);
      applyPresetIfIdle(get, set, id);
    },

    handlePlay: () => {
      const { remaining, minutes, seconds } = get();
      void startCountdown(remaining ?? minutes * 60 + seconds);
    },

    handlePause: () => {
      generation++;
      stopInterval();
      set({ running: false });
      void cancelTimerAlarm();
    },

    handleReset: () => {
      generation++;
      stopInterval();
      endTime = null;
      set({ running: false, alarming: false, remaining: null });
      void cancelTimerAlarm();
    },

    stopAlarm: () => {
      generation++; // invalidate an in-flight snooze (+1 min) restart, if any
      set({ alarming: false, remaining: null });
      void cancelTimerAlarm();
    },

    addOneMinute: () => {
      const { alarming, running } = get();
      if (alarming) {
        void startCountdown(SNOOZE_SECONDS);
        return;
      }
      if (running && endTime !== null) {
        endTime += SNOOZE_SECONDS * 1000;
        const secsLeft = Math.max(1, Math.round((endTime - Date.now()) / 1000));
        set({ remaining: secsLeft });
        void scheduleTimerAlarm(secsLeft);
      }
    },
  };
});
