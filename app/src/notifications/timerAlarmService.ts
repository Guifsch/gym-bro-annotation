import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  EventType,
  TriggerType,
} from '@notifee/react-native';
import { Platform, Vibration } from 'react-native';

export const TIMER_NOTIFICATION_ID = 'rest-timer-alarm';
export const RUNNING_NOTIFICATION_ID = 'rest-timer-running';
export const SNOOZE_SECONDS = 60;
// Android has no built-in cap on Vibration.vibrate(pattern, repeat: true) — without this, a
// missed/ignored alarm buzzes forever until the app is reopened.
const MAX_VIBRATION_MS = 30_000;

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
const CHANNEL_VERSION = 'v2';

function channelId(vibrar: boolean, som: boolean): string {
  return `timer-alarm-${CHANNEL_VERSION}-${vibrar ? 'vibrate' : 'novibrate'}-${som ? 'sound' : 'nosound'}`;
}

// Separate low-importance, silent channel for the "still running" indicator — it fires every time
// a timer starts, so it must never itself buzz/ring (that's what the alarm channels above are for).
const RUNNING_CHANNEL_ID = `timer-running-${CHANNEL_VERSION}`;

const TIMER_CHANNEL_PREFIXES = ['timer-alarm-', 'timer-running-'];

/** Deletes any leftover channel from a previous `CHANNEL_VERSION` — Android channels are
 * permanent once created (they survive app updates/rebuilds, only a full uninstall clears them),
 * so every version bump otherwise leaves the old ones behind forever, cluttering the notification
 * settings screen with duplicate "Timer de descanso" entries. */
async function pruneOldChannels(currentIds: Set<string>): Promise<void> {
  const existing = await notifee.getChannels();
  for (const channel of existing) {
    const isOwnedByThisFeature = TIMER_CHANNEL_PREFIXES.some((prefix) => channel.id.startsWith(prefix));
    if (isOwnedByThisFeature && !currentIds.has(channel.id)) {
      await notifee.deleteChannel(channel.id);
    }
  }
}

let channelsReadyPromise: Promise<void> | null = null;
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!channelsReadyPromise) {
    channelsReadyPromise = (async () => {
      const currentIds = new Set<string>([RUNNING_CHANNEL_ID]);
      for (const vibrar of [true, false]) {
        for (const som of [true, false]) {
          const id = channelId(vibrar, som);
          currentIds.add(id);
          await notifee.createChannel({
            id,
            name: 'Timer de descanso',
            importance: AndroidImportance.HIGH,
            vibration: vibrar,
            vibrationPattern: vibrar ? NOTIFICATION_VIBRATION_PATTERN : undefined,
            sound: som ? 'default' : undefined,
          });
        }
      }
      await notifee.createChannel({
        id: RUNNING_CHANNEL_ID,
        name: 'Timer em andamento',
        importance: AndroidImportance.LOW,
        vibration: false,
      });
      await pruneOldChannels(currentIds);
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

/** `SET_ALARM_CLOCK` (used below so the alarm survives Doze/backgrounding) needs the
 * "Alarms & reminders" special permission on Android 12+ — unlike POST_NOTIFICATIONS, there's no
 * plain runtime dialog for it, only a system Settings screen. If it's off, the OS silently
 * degrades or drops the exact trigger, which reads as "the timer sometimes just doesn't fire". */
async function ensureAlarmPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const settings = await notifee.getNotificationSettings();
  if (settings.android.alarm !== AndroidNotificationSetting.ENABLED) {
    await notifee.openAlarmPermissionSettings();
  }
}

/** Ongoing, silent notification shown for the whole time a timer is running, with a native
 * countdown chronometer — so the user can see it's still going from the notification shade
 * without needing to reopen the app. Separate from the `TIMER_NOTIFICATION_ID` trigger below,
 * which only fires once, at completion. */
async function showRunningNotification(seconds: number): Promise<void> {
  await notifee.displayNotification({
    id: RUNNING_NOTIFICATION_ID,
    title: 'Descanso em andamento',
    android: {
      channelId: RUNNING_CHANNEL_ID,
      smallIcon: 'ic_notification',
      ongoing: true,
      autoCancel: false,
      showChronometer: true,
      chronometerDirection: 'down',
      timestamp: Date.now() + seconds * 1000,
      category: AndroidCategory.PROGRESS,
      pressAction: { id: 'default' },
    },
  });
}

/** Exported so the JS-side countdown (in the timer store) can also clear the "running" indicator
 * as a safety net — e.g. if the trigger notification's own foreground-service callback never runs
 * (permission not granted, OS killed the process, etc.), this stops the native chronometer from
 * silently ticking into negative numbers forever once the app notices completion on its own. */
export async function cancelRunningNotification(): Promise<void> {
  await notifee.cancelNotification(RUNNING_NOTIFICATION_ID).catch(() => {});
}

export async function scheduleTimerAlarm(seconds: number): Promise<void> {
  await notifee.requestPermission();
  await ensureAlarmPermission();
  await ensureChannels();
  await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID).catch(() => {});

  await notifee.createTriggerNotification(
    {
      id: TIMER_NOTIFICATION_ID,
      title: 'Descanso finalizado!',
      android: {
        channelId: channelId(currentVibrar, currentSom),
        smallIcon: 'ic_notification',
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

  await showRunningNotification(seconds);
}

export async function cancelTimerAlarm(): Promise<void> {
  await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID).catch(() => {});
  await cancelRunningNotification();
  stopTimerAlarmService();
}

let stopResolver: (() => void) | null = null;
let autoStopTimeout: ReturnType<typeof setTimeout> | null = null;

/** Stops the continuous vibration loop the foreground service started, and lets the service end. */
export function stopTimerAlarmService(): void {
  Vibration.cancel();
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }
  stopResolver?.();
  stopResolver = null;
}

// Must be called at module scope (not inside a component) — notifee needs this registered before
// any trigger notification with `asForegroundService: true` can actually fire the service.
notifee.registerForegroundService(
  () =>
    new Promise<void>((resolve) => {
      stopResolver = resolve;
      // The countdown is over — the "Descanso finalizado!" trigger notification takes over now,
      // the running/chronometer one no longer applies.
      void cancelRunningNotification();
      Vibration.vibrate(FOREGROUND_VIBRATION_UNIT, true);
      autoStopTimeout = setTimeout(() => stopTimerAlarmService(), MAX_VIBRATION_MS);
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
