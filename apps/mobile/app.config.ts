import type { ExpoConfig } from 'expo/config';

/**
 * Expo app config. The API URL is not set here: it comes from EXPO_PUBLIC_API_URL, from `.env` in
 * development and from each build profile's `env` in eas.json for EAS builds.
 */
const config: ExpoConfig = {
  name: 'Corte',
  slug: 'corte',
  version: '0.0.0',
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
