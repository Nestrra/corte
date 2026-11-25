import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { colors, interaction, layout, radius, spacing } from '../theme';

const ICON_SIZE = spacing['2xl'];

/**
 * BellButton (specs/006-alerts-reminders/contracts/screens.md): a round 44 × 44 button with
 * `notifications-outline` in `primaryStrong` next to the home greeting. No unread counter.
 */
export function BellButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notificaciones"
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="notifications-outline" size={ICON_SIZE} color={colors.primaryStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: interaction.pressedOpacity },
});
