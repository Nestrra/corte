import { Pressable, StyleSheet, View } from 'react-native';
import type { NotificationStatus } from '../notifications/registration';
import { interaction, layout, spacing, type ColorToken } from '../theme';
import { Text } from './Text';

/** Written state, color and action of each status (contracts/screens.md → Estado en Perfil). */
const STATES: Record<NotificationStatus, { text: string; color: ColorToken; action?: string }> = {
  registered: { text: 'Activadas', color: 'success' },
  denied: { text: 'Desactivadas', color: 'warning', action: 'Abrir ajustes' },
  undetermined: { text: 'Sin activar', color: 'textSecondary', action: 'Activar' },
  unavailable: { text: 'No disponibles en este dispositivo', color: 'textSecondary' },
  pending: { text: 'Activando…', color: 'textSecondary' },
};

const CHECKING = { text: 'Revisando…', color: 'textSecondary' as ColorToken, action: undefined };

export interface NotificationStatusRowProps {
  /** Null while the first check runs. */
  status: NotificationStatus | null;
  onAction: () => void;
  busy?: boolean;
}

/**
 * NotificationStatusRow (specs/006-alerts-reminders/contracts/screens.md): "Notificaciones" with
 * its state written on the right and, when there is one, the action (`primaryStrong`, area 44).
 */
export function NotificationStatusRow({
  status,
  onAction,
  busy = false,
}: NotificationStatusRowProps) {
  const state = status === null ? CHECKING : STATES[status];
  return (
    <View style={styles.row}>
      <View style={styles.texts} accessible accessibilityLabel={`Notificaciones: ${state.text}`}>
        <Text>Notificaciones</Text>
        <Text variant="secondary" color={state.color} style={styles.state}>
          {state.text}
        </Text>
      </View>
      {state.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state.action}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text variant="bodyStrong" color="primaryStrong">
            {state.action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  texts: {
    minHeight: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  state: { flexShrink: 1, textAlign: 'right' },
  action: {
    minHeight: layout.minTouchTarget,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  pressed: { opacity: interaction.pressedOpacity },
});
