const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'app.notifee.core.ForegroundService';

/**
 * notifee's `asForegroundService` (used by the rest-timer's alarm, so it keeps vibrating even if
 * the app is backgrounded) needs its Android foreground service declared in the manifest with an
 * explicit `foregroundServiceType` — Android 14 refuses to start a foreground service with none.
 * `systemExempted` + `SCHEDULE_EXACT_ALARM` is the type Android designates for alarm-clock/timer
 * apps using `AlarmManager.setAlarmClock()` (what `AlarmType.SET_ALARM_CLOCK` maps to) — see
 * https://developer.android.com/about/versions/14/changes/fgs-types-required
 *
 * notifee ships no Expo config plugin of its own for this, so it's a one-off manifest patch here.
 */
module.exports = function withNotifeeForegroundService(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    application.service = application.service ?? [];
    const existing = application.service.find((service) => service.$?.['android:name'] === SERVICE_NAME);

    const attrs = {
      'android:name': SERVICE_NAME,
      'android:foregroundServiceType': 'systemExempted',
      'android:exported': 'false',
    };

    if (existing) {
      existing.$ = { ...existing.$, ...attrs };
    } else {
      application.service.push({ $: attrs });
    }

    return config;
  });
};
