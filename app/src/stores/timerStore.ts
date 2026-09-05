import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { AppState, Vibration } from 'react-native';
import { create } from 'zustand';

import { createTimerPreset, deleteTimerPreset, listTimerPresets } from '@/api/workoutApi';
import {
  RestTimerNative,
  isRestTimerNativeSupported,
  requestNotificationPermission,
  type NativeTimerState,
} from '@/native/rest-timer';
import { readJson, writeJson } from '@/offline/storage';
import type { TimerPreset } from '@/types/workout';

const MINI_BAR_ENABLED_KEY = 'timer:miniBarEnabled';
const DEFAULT_PRESET_ID_KEY = 'timer:defaultPresetId';
const VIBRAR_ATIVO_KEY = 'timer:vibrarAtivo';
const BUBBLE_ENABLED_KEY = 'timer:bubbleEnabled';
const SNOOZE_SECONDS = 60;

// Quem de fato agenda o alarme, vibra e desenha a bolinha flutuante é o módulo nativo
// `modules/rest-timer`. Esta store virou o espelho disso na UI: mantém um intervalo de 1s só pra
// redesenhar o contador dentro do app, e delega play/pause/reset pro nativo, que é a fonte da
// verdade — inclusive quando a ação veio dos botões da notificação com o app fechado.
//
// O caminho abaixo (`Vibration` do react-native) só sobrevive como fallback pra plataformas sem o
// módulo nativo (iOS/web): lá o alarme continua tocando só com o app aberto.
const MAX_VIBRATION_MS = 30_000;
const VIBRATION_PATTERN = [0, 700, 400];

let vibrationStopTimeout: ReturnType<typeof setTimeout> | null = null;

function startAlarmVibration(): void {
  Vibration.vibrate(VIBRATION_PATTERN, true);
  // Android has no built-in cap on Vibration.vibrate(pattern, repeat: true) — without this, a
  // missed/ignored alarm buzzes forever until the app is reopened.
  vibrationStopTimeout = setTimeout(() => stopAlarmVibration(), MAX_VIBRATION_MS);
}

function stopAlarmVibration(): void {
  Vibration.cancel();
  if (vibrationStopTimeout) {
    clearTimeout(vibrationStopTimeout);
    vibrationStopTimeout = null;
  }
}

interface TimerState {
  minutes: number;
  seconds: number;
  presets: TimerPreset[];
  savingPreset: boolean;
  remaining: number | null;
  running: boolean;
  alarming: boolean;
  vibrarAtivo: boolean;
  miniBarEnabled: boolean;
  bubbleEnabled: boolean;
  defaultPresetId: string | null;
  /** Espelha o que o Android diz: com isso desligado o timer ainda vibra no fim, mas nada
   * aparece na barra de notificações. Só o sistema liga/desliga — o app não tem essa chave. */
  notificationsEnabled: boolean;
  /** Só no Android 12 com "alarmes e lembretes" revogado — o alarme pode atrasar alguns minutos. */
  exactAlarmBlocked: boolean;
  /** "Exibir sobre outros apps" negado: a bolinha não tem como aparecer. */
  bubbleBlocked: boolean;

  hydrate: () => Promise<void>;
  setMinutes: (updater: (m: number) => number) => void;
  setSeconds: (updater: (s: number) => number) => void;
  selectPreset: (preset: TimerPreset) => void;
  saveCurrentAsPreset: () => Promise<TimerPreset | null>;
  deletePreset: (preset: TimerPreset) => Promise<void>;
  setVibrarAtivo: (value: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMiniBarEnabled: (enabled: boolean) => void;
  setBubbleEnabled: (enabled: boolean) => void;
  setDefaultPresetId: (id: string | null) => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleReset: () => void;
  stopAlarm: () => void;
  addOneMinute: () => void;
  openTimerSettings: () => void;
  openBubbleSettings: () => void;
}

// Timer bookkeeping that isn't meant to be reactive UI state lives as module-scope singletons —
// the store itself is already a singleton (created once at import time).
let intervalId: ReturnType<typeof setInterval> | null = null;
// Absolute end timestamp, not a tick counter — JS timers get throttled/paused while the app is
// backgrounded, so counting down via fixed decrements per tick drifts behind real elapsed time.
let endTime: number | null = null;
// A permissão é pedida uma vez por sessão, no primeiro play: insistir a cada play viraria um
// diálogo repetido pra quem já disse não de propósito.
let notificationPermissionRequested = false;

function stopInterval() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

function secondsUntil(timestamp: number): number {
  return Math.max(0, Math.round((timestamp - Date.now()) / 1000));
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
    const secsLeft = secondsUntil(endTime);
    set({ remaining: secsLeft });
    if (secsLeft <= 0) {
      stopInterval();
      endTime = null;
      set({ running: false, alarming: true });
      // Com o módulo nativo, quem vibra é o serviço de alarme — ele funciona com a tela bloqueada
      // e com o app fechado, que é justamente quando este `tick()` nem chega a rodar.
      if (!isRestTimerNativeSupported && get().vibrarAtivo) startAlarmVibration();
    }
  }

  function ensureInterval() {
    if (!intervalId) intervalId = setInterval(tick, 1000);
  }

  function startCountdown(startFrom: number) {
    if (startFrom <= 0) return;
    endTime = Date.now() + startFrom * 1000;
    set({ remaining: startFrom, running: true, alarming: false });

    stopInterval();
    ensureInterval();
  }

  /** Traz a UI pro estado que o nativo diz ser o real — na volta do background, ou quando o
   * usuário mexeu nos botões da notificação. */
  function applyNativeState(state: NativeTimerState) {
    switch (state.status) {
      case 'running':
        endTime = state.endsAt;
        set({ running: true, alarming: false, remaining: secondsUntil(state.endsAt) });
        ensureInterval();
        break;
      case 'paused':
        stopInterval();
        endTime = null;
        set({ running: false, alarming: false, remaining: Math.max(0, Math.round(state.remainingMs / 1000)) });
        break;
      case 'finished':
        stopInterval();
        endTime = null;
        set({ running: false, alarming: true, remaining: 0 });
        break;
      case 'idle':
        stopInterval();
        endTime = null;
        set({ running: false, alarming: false, remaining: null });
        break;
    }
  }

  function refreshPermissionFlags() {
    if (!isRestTimerNativeSupported) return;
    const overlayAllowed = RestTimerNative!.canDrawOverlays();
    const { bubbleEnabled, bubbleBlocked } = get();
    // Voltou das configurações do sistema com a permissão concedida: reavisa o nativo, senão a
    // bolinha só apareceria no próximo play (o `sync` dela mora no commit de estado do Kotlin).
    if (bubbleEnabled && overlayAllowed && bubbleBlocked) RestTimerNative!.setBubbleEnabled(true);
    set({
      notificationsEnabled: RestTimerNative!.areNotificationsEnabled(),
      exactAlarmBlocked: !RestTimerNative!.canScheduleExactAlarms(),
      bubbleBlocked: bubbleEnabled && !overlayAllowed,
    });
  }

  async function ensureNotificationAccess() {
    if (!isRestTimerNativeSupported || notificationPermissionRequested) return;
    notificationPermissionRequested = true;
    await requestNotificationPermission();
    refreshPermissionFlags();
  }

  /** Toque na notificação (fora dos botões) ou na bolinha abre o app já na tela do timer. */
  function openTimerScreenIfRequested() {
    if (!isRestTimerNativeSupported) return;
    if (RestTimerNative!.consumeOpenTimerRequest()) router.push('/(tabs)/extras/timer');
  }

  // Registered once for the app's lifetime (this store is a singleton) instead of per mounted
  // screen, so the countdown keeps resyncing on foreground even while no timer UI is on screen.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (isRestTimerNativeSupported) {
      applyNativeState(RestTimerNative!.getState());
      // Voltar pro app é também a volta das telas de permissão do sistema.
      refreshPermissionFlags();
      openTimerScreenIfRequested();
      return;
    }
    const { running } = get();
    if (endTime === null || !running) return;
    tick();
  });

  // Pausar/Zerar/+1 min tocados na notificação chegam por aqui — sem isso a barra fixa e a tela do
  // timer mostrariam o estado velho ao voltar pro app.
  if (isRestTimerNativeSupported) {
    RestTimerNative!.addListener('onTimerStateChange', applyNativeState);
  }

  return {
    minutes: 2,
    seconds: 0,
    presets: [],
    savingPreset: false,
    remaining: null,
    running: false,
    alarming: false,
    vibrarAtivo: true,
    miniBarEnabled: false,
    bubbleEnabled: false,
    defaultPresetId: null,
    notificationsEnabled: true,
    exactAlarmBlocked: false,
    bubbleBlocked: false,

    hydrate: async () => {
      const [presets, miniBarEnabled, defaultPresetId, vibrarAtivo, bubbleEnabled] = await Promise.all([
        listTimerPresets(),
        readJson(MINI_BAR_ENABLED_KEY, false),
        readJson<string | null>(DEFAULT_PRESET_ID_KEY, null),
        readJson(VIBRAR_ATIVO_KEY, true),
        readJson(BUBBLE_ENABLED_KEY, false),
      ]);
      set({ presets, miniBarEnabled, defaultPresetId, vibrarAtivo, bubbleEnabled });

      if (isRestTimerNativeSupported) {
        RestTimerNative!.setVibrationEnabled(vibrarAtivo);
        RestTimerNative!.setBubbleEnabled(bubbleEnabled);
        // O app pode estar abrindo com um timer já rodando (ou já concluído) lá fora.
        applyNativeState(RestTimerNative!.getState());
        refreshPermissionFlags();
        // Abertura a frio pela notificação não passa pelo AppState (o app já nasce 'active'),
        // então o pedido de abrir a tela do timer também é consumido aqui.
        openTimerScreenIfRequested();
      }

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
      void writeJson(VIBRAR_ATIVO_KEY, value);
      // O nativo precisa saber disso mesmo com o app fechado (é ele quem vibra), então a
      // preferência mora nos dois lados: aqui pro switch, e no SharedPreferences pro serviço.
      if (isRestTimerNativeSupported) RestTimerNative!.setVibrationEnabled(value);
      if (!value) stopAlarmVibration();
    },

    setNotificationsEnabled: (enabled) => {
      if (!isRestTimerNativeSupported) return;

      // O Android não deixa o app mexer na própria permissão: desligar só existe nas
      // configurações do sistema, e o diálogo de pedir some depois de duas negações. Então cada
      // direção do switch leva pro único lugar que funciona.
      if (!enabled) {
        RestTimerNative!.openNotificationSettings();
        return;
      }

      void (async () => {
        await requestNotificationPermission();
        // Re-lê do sistema em vez de confiar no retorno: no Android 12 não há permissão pra pedir
        // e mesmo assim as notificações podem estar desligadas nas configurações.
        const granted = RestTimerNative!.areNotificationsEnabled();
        set({ notificationsEnabled: granted });
        if (!granted) RestTimerNative!.openNotificationSettings();
      })();
    },

    setMiniBarEnabled: (enabled) => {
      set({ miniBarEnabled: enabled });
      void writeJson(MINI_BAR_ENABLED_KEY, enabled);
    },

    setBubbleEnabled: (enabled) => {
      set({ bubbleEnabled: enabled });
      void writeJson(BUBBLE_ENABLED_KEY, enabled);
      if (!isRestTimerNativeSupported) return;

      RestTimerNative!.setBubbleEnabled(enabled);

      // "Exibir sobre outros apps" não é uma permissão de diálogo: só existe a tela de
      // configurações do sistema. Ligar o switch sem ela leva direto pra lá.
      const allowed = RestTimerNative!.canDrawOverlays();
      set({ bubbleBlocked: enabled && !allowed });
      if (enabled && !allowed) RestTimerNative!.openOverlaySettings();
    },

    setDefaultPresetId: (id) => {
      set({ defaultPresetId: id });
      void writeJson(DEFAULT_PRESET_ID_KEY, id);
      applyPresetIfIdle(get, set, id);
    },

    handlePlay: () => {
      const { remaining, minutes, seconds } = get();
      const total = remaining ?? minutes * 60 + seconds;
      if (total <= 0) return;

      if (isRestTimerNativeSupported) {
        RestTimerNative!.start(total);
        void ensureNotificationAccess();
      }
      // Espelho local imediato: o evento nativo confirma o mesmo estado logo em seguida, mas a UI
      // não pode esperar um round-trip pra sair do zero.
      startCountdown(total);
    },

    handlePause: () => {
      if (isRestTimerNativeSupported) RestTimerNative!.pause();
      stopInterval();
      endTime = null;
      set({ running: false });
      stopAlarmVibration();
    },

    handleReset: () => {
      if (isRestTimerNativeSupported) RestTimerNative!.reset();
      stopInterval();
      endTime = null;
      set({ running: false, alarming: false, remaining: null });
      stopAlarmVibration();
    },

    stopAlarm: () => {
      if (isRestTimerNativeSupported) RestTimerNative!.stopAlarm();
      set({ alarming: false, remaining: null });
      stopAlarmVibration();
    },

    addOneMinute: () => {
      const { alarming, running } = get();
      if (isRestTimerNativeSupported) RestTimerNative!.addMinute();

      if (alarming) {
        stopAlarmVibration();
        startCountdown(SNOOZE_SECONDS);
        return;
      }
      if (running && endTime !== null) {
        endTime += SNOOZE_SECONDS * 1000;
        const secsLeft = Math.max(1, secondsUntil(endTime));
        set({ remaining: secsLeft });
      }
    },

    /** Atalho pras configurações do sistema quando o alarme está capado por permissão. */
    openTimerSettings: () => {
      if (!isRestTimerNativeSupported) return;
      if (!get().notificationsEnabled) RestTimerNative!.openNotificationSettings();
      else if (get().exactAlarmBlocked) RestTimerNative!.openExactAlarmSettings();
    },

    openBubbleSettings: () => {
      if (isRestTimerNativeSupported) RestTimerNative!.openOverlaySettings();
    },
  };
});
