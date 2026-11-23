import { Stack } from 'expo-router';
import { useSessionStore } from '../../session/session-store';
import { colors, typography } from '../../theme';

export const unstable_settings = { anchor: '(tabs)' };

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="card/new" options={{ title: 'Nueva tarjeta' }} />
        <Stack.Screen name="card/[id]/index" options={{ title: 'Tarjeta' }} />
        <Stack.Screen name="card/[id]/edit" options={{ title: 'Editar tarjeta' }} />
        <Stack.Screen name="card/archived" options={{ title: 'Archivadas' }} />
        <Stack.Screen name="card/[id]/purchases/index" options={{ title: 'Compras' }} />
        <Stack.Screen name="card/[id]/purchases/new" options={{ title: 'Registrar compra' }} />
        <Stack.Screen name="card/[id]/statements" options={{ title: 'Extractos' }} />
        <Stack.Screen name="purchase/[id]/index" options={{ title: 'Compra' }} />
        <Stack.Screen name="purchase/[id]/edit" options={{ title: 'Editar compra' }} />
        <Stack.Screen name="statement/[id]" options={{ title: 'Extracto' }} />
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
