// This file runs in Node (Expo CLI, EAS), not in the app: it needs Node's types, which TypeScript 6
// no longer includes by default.
/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

/** EAS project id (README → "Builds con EAS"); also the EAS Update URL's last segment. */
const EAS_PROJECT_ID = 'bdb6af21-da0d-4fae-ae2c-453cd9402ed9';

/**
 * Firebase config for FCM push (README → "Credenciales de push"). EAS builds get its path from the
 * GOOGLE_SERVICES_JSON file variable; locally it is ./google-services.json (git-ignored), used only
 * if it exists. With neither, the property is left out: Expo rejects a path to a missing file.
 */
const LOCAL_GOOGLE_SERVICES_FILE = './google-services.json';
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync(join(__dirname, LOCAL_GOOGLE_SERVICES_FILE))
    ? LOCAL_GOOGLE_SERVICES_FILE
    : undefined);

/**
 * Expo app config. The API URL is not set here: it comes from EXPO_PUBLIC_API_URL, from `.env` in
 * development and from each build profile's `env` in eas.json for EAS builds.
 *
 * EAS Update: each build listens to the channel of its eas.json profile (development, staging,
 * production) and only takes updates with its same runtime version. The `appVersion` policy makes
 * the runtime version equal to `version` below. Bump `version` every time something native
 * changes (plugins, packages with native code, permissions, native config) and make a new build;
 * otherwise an update could reach a build whose native side differs (README → "Versión de
 * runtime"). `fingerprint` is not used because the GOOGLE_SERVICES_JSON secret file only exists on
 * EAS, so the local and EAS fingerprints never match.
 */
const config: ExpoConfig = {
  name: 'Corte',
  slug: 'corte',
  version: '0.0.0',
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
  extra: { eas: { projectId: EAS_PROJECT_ID } },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'corte',
  ios: {
    bundleIdentifier: 'io.nrcintelligence.corte',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'io.nrcintelligence.corte',
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F6F7F9',
        image: './assets/splash-icon.png',
        imageWidth: 200,
      },
    ],
    'expo-status-bar',
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    'expo-notifications',
  ],
};

export default config;
