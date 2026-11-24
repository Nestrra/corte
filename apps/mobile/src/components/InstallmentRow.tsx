import type { StatementStatus } from '@corte/domain';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatCop } from '../features/money';
import { colors, interaction, layout, spacing } from '../theme';
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
  /** Status of the statement the installment falls in (purchase detail and simulation). */
  status?: StatementStatus;
  /**
   * Values of a simulation being recalculated (spec 004 research.md R7): the texts and amounts
   * are dimmed with `interaction.staleOpacity`; the StatusChip never is (AA).
   */
  dimmed?: boolean;
}

function Amounts({
  principal,
  interest,
  dimmed,
}: {
  principal: number;
  interest: number;
  dimmed: boolean;
}): ReactNode {
  return (
    <View style={[styles.right, dimmed && styles.dimmed]}>
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
  dimmed = false,
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
        <View style={[styles.left, dimmed && styles.dimmed]}>
          <Text numberOfLines={2}>{title}</Text>
          <Text variant="secondary" color="textSecondary">
            Cuota {position}
          </Text>
        </View>
        {status ? <StatusChip status={status} style={styles.chip} /> : null}
      </View>
      <Amounts principal={principal} interest={interest} dimmed={dimmed} />
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
  /** Right-aligned under the amount, so chips line up whatever the amount's width. */
  chip: { alignSelf: 'flex-end' },
  dimmed: { opacity: interaction.staleOpacity },
});
