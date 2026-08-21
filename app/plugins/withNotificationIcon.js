const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Android notification "small icons" must be a plain white silhouette on a transparent
 * background — the OS masks the icon itself and ignores color, so a full-color icon (the app's
 * own launcher icon, notifee's default fallback when no `smallIcon` is set) renders as a solid
 * black/white box instead of a shape. Copies a pre-rendered silhouette into the generated
 * Android project so it survives every `expo prebuild`, referenced from JS as `smallIcon:
 * 'ic_notification'` (Android resource name, no extension).
 */
module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const source = path.join(config.modRequest.projectRoot, 'assets/images/notification-icon.png');
      const destDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      const dest = path.join(destDir, 'ic_notification.png');

      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(source, dest);

      return config;
    },
  ]);
};
