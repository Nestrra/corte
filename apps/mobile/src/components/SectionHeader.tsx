import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Text } from './Text';

const ICON_SIZE = spacing.xl;

/**
 * SectionHeader of docs/design-system.md: section title and a secondary button with a + icon
 * ("Agregar", "Nuevo"). The button is ≥ 44 and says what it adds through `actionLabel`.
 */
export function SectionHeader({
  title,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  /** Visible text of the button. */
  action: string;
  /** Accessible label of the button, e.g. "Agregar tarjeta". */
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={ICON_SIZE} color={colors.primaryStrong} />
        <Text variant="bodyStrong" color="primaryStrong">
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1 },
  action: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: interaction.pressedOpacity },
});
