import type { ExpoConfig } from 'expo/config';

/** EAS project id (README → "Builds con EAS"); also the EAS Update URL's last segment. */
const EAS_PROJECT_ID = 'bdb6af21-da0d-4fae-ae2c-453cd9402ed9';

/**
 * Expo app config. The API URL is not set here: it comes from EXPO_PUBLIC_API_URL, from `.env` in
 * development and from each build profile's `env` in eas.json for EAS builds.
 *
 * EAS Update: each build listens to the channel of its eas.json profile (development, staging,
 * production) and only takes updates with its same runtime version. The `fingerprint` policy
 * derives that version from a hash of the native code and config, so an update can never reach a
 * build whose native side differs; any native change requires a new build.
 */
const config: ExpoConfig = {
  name: 'Corte',
  slug: 'corte',
  version: '0.0.0',
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
  extra: { eas: { projectId: EAS_PROJECT_ID } },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'corte',
  ios: {
    bundleIdentifier: 'io.nrcintelligence.corte',
    supportsTablet: true,
  },
  android: {
    package: 'io.nrcintelligence.corte',
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
