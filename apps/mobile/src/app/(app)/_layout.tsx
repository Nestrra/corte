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
        <Stack.Screen name="card/[id]/statements" options={{ title: 'Extractos' }} />
        <Stack.Screen name="purchase/new" options={{ title: 'Registrar compra' }} />
        <Stack.Screen name="purchase/[id]/index" options={{ title: 'Compra' }} />
        <Stack.Screen name="purchase/[id]/edit" options={{ title: 'Editar compra' }} />
        <Stack.Screen name="statement/[id]" options={{ title: 'Extracto' }} />
        <Stack.Screen name="recurring/index" options={{ title: 'Mis pagos' }} />
        <Stack.Screen name="recurring/new" options={{ title: 'Nuevo pago' }} />
        <Stack.Screen name="recurring/[id]/index" options={{ title: 'Pago' }} />
        <Stack.Screen name="recurring/[id]/edit" options={{ title: 'Editar pago' }} />
        <Stack.Screen name="occurrence/[id]/index" options={{ title: 'Pago del mes' }} />
        {/* Native sheet (react-native-screens), no extra dependency (spec 005 research.md R10). */}
        <Stack.Screen
          name="occurrence/[id]/pay"
          options={{
            title: 'Marcar pagado',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
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
