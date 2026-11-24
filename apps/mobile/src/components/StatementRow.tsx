import { Pressable, StyleSheet, View } from 'react-native';
import type { Statement } from '../api/statements';
import { formatLongDate, formatShortDate } from '../features/dates';
import { formatCop } from '../features/money';
import { colors, interaction, layout, spacing } from '../theme';
import { StatusChip, statusLabel } from './StatusChip';
import { Text } from './Text';

/** The amount shown for a statement: what was paid, or what there is to pay. */
export function statementAmountText(statement: Statement): string {
  const amount = formatCop(statement.total);
  return statement.hasInterest ? `${amount} (estimado)` : amount;
}

/**
 * Statement row of specs/003-purchases/contracts/screens.md → StatementRow (a ListRow): dates on the
 * left, "A pagar" and the StatusChip on the right. Touch area ≥ 44; read as one sentence.
 */
export function StatementRow({
  statement,
  onPress,
}: {
  statement: Statement;
  onPress: () => void;
}) {
  const label = [
    `Extracto con corte el ${formatLongDate(statement.cutoffDate)}`,
    `paga hasta el ${formatLongDate(statement.dueDate)}`,
    `a pagar ${statementAmountText(statement)}`,
    `estado ${statusLabel(statement.status)}`,
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el detalle del extracto"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text variant="bodyStrong">Corte {formatShortDate(statement.cutoffDate)}</Text>
        <Text variant="secondary" color="textSecondary">
          Paga hasta {formatShortDate(statement.dueDate)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyStrong" style={styles.tabular}>
          {formatCop(statement.total)}
        </Text>
        {statement.hasInterest ? (
          <Text variant="caption" color="textSecondary">
            estimado
          </Text>
        ) : null}
        <StatusChip status={statement.status} style={styles.chip} />
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
  right: { alignItems: 'flex-end', gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  /** Right-aligned under the amount, so chips line up whatever the amount's width. */
  chip: { alignSelf: 'flex-end' },
  pressed: { opacity: interaction.pressedOpacity },
});
