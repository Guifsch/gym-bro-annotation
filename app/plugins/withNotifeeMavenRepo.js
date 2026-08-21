const { withProjectBuildGradle } = require('@expo/config-plugins');

const NOTIFEE_REPO_LINE = 'maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';

/**
 * `app.notifee:core` isn't published on Google's Maven, Maven Central or JitPack — the only place
 * it exists is a Maven repo bundled inside the npm package itself (`android/libs`). notifee's own
 * `android/build.gradle` tries to register that repo via `rootProject.allprojects { repositories
 * { ... } }`, but that registration runs too late to matter when Gradle is invoked with
 * `--configure-on-demand` — which `expo run:android` always passes — since `:app`'s dependency
 * resolution can start before `:notifee_react-native`'s own build.gradle has been configured.
 * Longstanding, never-fixed upstream bug (the repo is now archived) — see
 * https://github.com/invertase/notifee/issues/350 and several near-duplicates.
 *
 * Registering the repo directly on the ROOT project's own `allprojects` here sidesteps the
 * ordering problem, since the root build.gradle is always configured first regardless of
 * configure-on-demand.
 */
module.exports = function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;
    if (config.modResults.contents.includes(NOTIFEE_REPO_LINE)) return config;

    config.modResults.contents = config.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}\n    ${NOTIFEE_REPO_LINE}`
    );

    return config;
  });
};
