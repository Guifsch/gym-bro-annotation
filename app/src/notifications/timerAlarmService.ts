import notifee, { AlarmType, AndroidCategory, AndroidImportance, EventType, TriggerType } from '@notifee/react-native';
import { Platform, Vibration } from 'react-native';

export const TIMER_NOTIFICATION_ID = 'rest-timer-alarm';
export const SNOOZE_SECONDS = 60;

const FOREGROUND_VIBRATION_UNIT = [0, 700, 400];

// A long insistent buzz for the moment the alarm notification is delivered, on top of the
// continuous vibration the foreground service keeps running afterwards. notifee validates this
// array strictly: every value must be positive and the count must be even (no leading 0 delay,
// unlike the plain Vibration API).
function buildLongVibrationPattern(repeats: number): number[] {
  const pattern: number[] = [];
  for (let i = 0; i < repeats; i++) pattern.push(700, 400);
  return pattern;
}
const NOTIFICATION_VIBRATION_PATTERN = buildLongVibrationPattern(20);

// Android notification channels are immutable once created — bump this if the channel config
// (vibration pattern, sound) ever changes again, otherwise devices that already created the old
// channel silently keep the old behavior.
const CHANNEL_VERSION = 'v1';

function channelId(vibrar: boolean, som: boolean): string {
  return `timer-alarm-${CHANNEL_VERSION}-${vibrar ? 'vibrate' : 'novibrate'}-${som ? 'sound' : 'nosound'}`;
}

let channelsReadyPromise: Promise<void> | null = null;
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!channelsReadyPromise) {
    channelsReadyPromise = (async () => {
      for (const vibrar of [true, false]) {
        for (const som of [true, false]) {
          await notifee.createChannel({
            id: channelId(vibrar, som),
            name: 'Timer de descanso',
            importance: AndroidImportance.HIGH,
            vibration: vibrar,
            vibrationPattern: vibrar ? NOTIFICATION_VIBRATION_PATTERN : undefined,
            sound: som ? 'default' : undefined,
          });
        }
      }
    })().catch((err) => {
      channelsReadyPromise = null; // let the next call retry instead of replaying this failure forever
      throw err;
    });
  }
  return channelsReadyPromise;
}

// Kept in sync by the component whenever the Vibrar/Som switches change, and read here so a
// notification action tap (which can arrive with the component unmounted, e.g. app backgrounded
// and later killed) still knows which channel/behavior to use for a snooze reschedule.
let currentVibrar = true;
let currentSom = true;
export function setTimerAlarmPrefs(vibrar: boolean, som: boolean): void {
  currentVibrar = vibrar;
  currentSom = som;
}

export async function scheduleTimerAlarm(seconds: number): Promise<void> {
  await notifee.requestPermission();
  await ensureChannels();
  await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID).catch(() => {});

  await notifee.createTriggerNotification(
    {
      id: TIMER_NOTIFICATION_ID,
      title: 'Descanso finalizado!',
      android: {
        channelId: channelId(currentVibrar, currentSom),
        asForegroundService: true,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        actions: [
          { title: '+1 min', pressAction: { id: 'snooze' } },
          { title: 'Pausar', pressAction: { id: 'pause' } },
        ],
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
      // SET_ALARM_CLOCK is the same exact, Doze-exempt delivery real alarm-clock apps use — a plain
      // trigger notification (the default) can be delayed by the system for minutes with the screen off.
      alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
    }
  );
}

export async function cancelTimerAlarm(): Promise<void> {
  await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID).catch(() => {});
  stopTimerAlarmService();
}

let stopResolver: (() => void) | null = null;

/** Stops the continuous vibration loop the foreground service started, and lets the service end. */
export function stopTimerAlarmService(): void {
  Vibration.cancel();
  stopResolver?.();
  stopResolver = null;
}

// Must be called at module scope (not inside a component) — notifee needs this registered before
// any trigger notification with `asForegroundService: true` can actually fire the service.
notifee.registerForegroundService(
  () =>
    new Promise<void>((resolve) => {
      stopResolver = resolve;
      Vibration.vibrate(FOREGROUND_VIBRATION_UNIT, true);
    })
);

export type TimerAlarmAction = 'snooze' | 'pause';
type TimerAlarmListener = (action: TimerAlarmAction) => void;

let listener: TimerAlarmListener | null = null;
/** The mounted RestTimer (if any) subscribes here to sync its on-screen state to actions taken from the notification. */
export function setTimerAlarmListener(fn: TimerAlarmListener | null): void {
  listener = fn;
}

async function handleNotificationEvent(event: { type: EventType; detail: { pressAction?: { id: string } } }) {
  if (event.type !== EventType.ACTION_PRESS) return;
  const actionId = event.detail.pressAction?.id;

  if (actionId === 'snooze') {
    stopTimerAlarmService();
    await scheduleTimerAlarm(SNOOZE_SECONDS);
    listener?.('snooze');
  } else if (actionId === 'pause') {
    await cancelTimerAlarm();
    listener?.('pause');
  }
}

notifee.onForegroundEvent(handleNotificationEvent);
notifee.onBackgroundEvent(handleNotificationEvent);
