import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NETWORK_ERROR_TEXT } from '../api/errors';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import {
  configureForegroundNotifications,
  discardLaunchResponse,
} from '../notifications/use-notifications';
import { bootstrapSession } from '../session/bootstrap';
import { useSessionStore } from '../session/session-store';
import { colors, layout, spacing } from '../theme';

// Keep the splash screen until fonts are ready and the stored session has been checked.
void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

/** A stored session exists but the API did not answer (contracts/screens.md → offline). */
function OfflineScreen() {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await bootstrapSession();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <SafeAreaView style={styles.offline}>
      <View style={styles.offlineText}>
        <Text variant="section" accessibilityRole="header">
          Sin conexión con el servidor
        </Text>
        <Text color="textSecondary" accessibilityLiveRegion="polite">
          {NETWORK_ERROR_TEXT}
        </Text>
      </View>
      <Button label="Reintentar" onPress={() => void retry()} loading={retrying} />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const status = useSessionStore((state) => state.status);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  // If fonts fail to load, continue with the system font instead of blocking the app.
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = fontsReady && status !== 'restoring';

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // A push that opened the app without a session is not opened after a later sign-in.
  useEffect(() => {
    if (status === 'signedOut') discardLaunchResponse();
  }, [status]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {status === 'offline' ? (
        <OfflineScreen />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          {/* "/" redirects by session state (app/index.tsx); always reachable. */}
          <Stack.Screen name="index" />
          <Stack.Protected guard={status === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedIn'}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      )}
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  offline: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    gap: layout.sectionGap,
  },
  offlineText: { gap: spacing.sm },
});
