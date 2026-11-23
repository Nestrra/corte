import type { StatementStatus } from '@corte/domain';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatCop } from '../features/money';
import { colors, layout, spacing } from '../theme';
import { StatusChip, statusLabel } from './StatusChip';
import { Text } from './Text';

export interface InstallmentRowProps {
  /** Concept of the purchase (statement detail) or the statement dates (purchase detail). */
  title: string;
  /** "3 de 12". */
  position: string;
  principal: number;
  /** Estimated interest; always shown with "(estimado)" (principle IV). */
  interest: number;
  /** Status of the statement the installment falls in (purchase detail only). */
  status?: StatementStatus;
}

function Amounts({ principal, interest }: { principal: number; interest: number }): ReactNode {
  return (
    <View style={styles.right}>
      <Text variant="bodyStrong" style={styles.tabular}>
        {formatCop(principal)}
      </Text>
      <Text variant="caption" color="textSecondary" style={styles.tabular}>
        Interés {formatCop(interest)} (estimado)
      </Text>
    </View>
  );
}

/**
 * Installment row of specs/003-purchases/contracts/screens.md → InstallmentRow: concept and
 * "k de n" on the left; principal and estimated interest on the right.
 */
export function InstallmentRow({
  title,
  position,
  principal,
  interest,
  status,
}: InstallmentRowProps) {
  const label = [
    title,
    `cuota ${position}`,
    `abono ${formatCop(principal)}`,
    `interés ${formatCop(interest)} estimado`,
    status ? `extracto ${statusLabel(status)}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={styles.left}>
        <Text numberOfLines={2}>{title}</Text>
        <Text variant="secondary" color="textSecondary">
          Cuota {position}
        </Text>
        {status ? <StatusChip status={status} /> : null}
      </View>
      <Amounts principal={principal} interest={interest} />
    </View>
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
});
