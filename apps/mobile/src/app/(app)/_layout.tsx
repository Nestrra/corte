import { Stack } from 'expo-router';
import { useSessionStore } from '../../session/session-store';
import { colors, typography } from '../../theme';

export const unstable_settings = { anchor: 'home' };

export default function AppLayout() {
  const mustChangePassword = useSessionStore((state) => state.user?.mustChangePassword ?? false);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.bodyStrong, color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* While a temporary password is pending only change-password is reachable (FR-026). */}
      <Stack.Protected guard={!mustChangePassword}>
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
        <Stack.Screen name="timezone" options={{ title: 'Zona horaria' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Eliminar cuenta' }} />
      </Stack.Protected>
      <Stack.Screen
        name="change-password"
        options={{
          title: 'Cambiar contraseña',
          headerBackVisible: !mustChangePassword,
          gestureEnabled: !mustChangePassword,
        }}
      />
    </Stack>
  );
}
