import { NativeModule, requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

/** Wrapper JS do módulo nativo em `modules/rest-timer/` (Android). Fica aqui, e não junto do
 * Kotlin, porque o alias `@/*` do tsconfig aponta só para `src/` — ver `modules/rest-timer/README.md`. */

export type NativeTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface NativeTimerState {
  status: NativeTimerStatus;
  /** Timestamp absoluto (ms) do 00:00. Só significa algo quando `status === 'running'`. */
  endsAt: number;
  /** Tempo congelado (ms). Só significa algo quando `status === 'paused'`. */
  remainingMs: number;
  totalMs: number;
  vibrationEnabled: boolean;
  bubbleEnabled: boolean;
}

type RestTimerModuleEvents = {
  onTimerStateChange: (state: NativeTimerState) => void;
};

declare class RestTimerNativeModule extends NativeModule<RestTimerModuleEvents> {
  getState(): NativeTimerState;
  /** `true` uma única vez quando o app foi reaberto pela notificação ou pela bolinha. */
  consumeOpenTimerRequest(): boolean;
  start(totalSeconds: number): void;
  pause(): void;
  resume(): void;
  reset(): void;
  stopAlarm(): void;
  addMinute(): void;
  setVibrationEnabled(enabled: boolean): void;
  setBubbleEnabled(enabled: boolean): void;
  canDrawOverlays(): boolean;
  openOverlaySettings(): void;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
  openNotificationSettings(): void;
}

const nativeModule = requireOptionalNativeModule<RestTimerNativeModule>('RestTimer');

/** `false` no iOS/web e em qualquer build antigo sem o módulo nativo — nesses casos a store cai no
 * alarme antigo, que só funciona com o app aberto. */
export const isRestTimerNativeSupported = Platform.OS === 'android' && nativeModule !== null;

export const RestTimerNative = nativeModule;

/** Pede POST_NOTIFICATIONS (Android 13+). Sem ela o timer continua contando e vibrando, mas nada
 * aparece na barra de notificações — que é justamente o ponto da feature. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
