import { parseIsoDate } from '@corte/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Occurrence } from '../api/recurring';
import { MONTH_NAMES } from '../features/dates';
import { formatDayMonth } from '../features/days';
import { formatCop } from '../features/money';
import { colors, interaction, layout, spacing } from '../theme';
import { StatusChip, statusLabel } from './StatusChip';
import { Text } from './Text';

/** The amount shown for an occurrence: what was paid, or what is expected. */
export function occurrenceAmount(occurrence: Occurrence): number {
  return occurrence.paidAmount ?? occurrence.expectedAmount;
}

/** "10 de noviembre", for the accessible label. */
function spokenDate(date: string): string {
  const { month, day } = parseIsoDate(date);
  return `${day} de ${MONTH_NAMES[month - 1]}`;
}

/**
 * ListRow of docs/design-system.md for an occurrence (specs/005-recurring-payments/contracts/
 * screens.md → RecurringRow): name and short date on the left, amount and StatusChip on the
 * right. Touch area ≥ 44; read as "Gimnasio, 10 de noviembre, $120.000, vencido".
 */
export function RecurringRow({
  occurrence,
  onPress,
}: {
  occurrence: Occurrence;
  onPress: () => void;
}) {
  const amount = formatCop(occurrenceAmount(occurrence));
  const label = [
    occurrence.name,
    spokenDate(occurrence.dueDate),
    amount,
    statusLabel(occurrence.status).toLowerCase(),
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el detalle del pago"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {occurrence.name}
        </Text>
        <Text variant="secondary" color="textSecondary">
          {formatDayMonth(occurrence.dueDate)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit style={styles.tabular}>
          {amount}
        </Text>
        <StatusChip status={occurrence.status} style={styles.chip} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  left: { flex: 1, gap: spacing.xs },
  right: { flexShrink: 1, alignItems: 'flex-end', gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  /** Right-aligned under the amount, so chips line up whatever the amount's width. */
  chip: { alignSelf: 'flex-end' },
  pressed: { opacity: interaction.pressedOpacity },
});
