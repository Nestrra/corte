import type { StatementStatus } from '@corte/domain';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, type ColorToken } from '../theme';
import { Text } from './Text';

/**
 * Statement status chip (docs/design-system.md → StatusChip; specs/003-purchases/contracts/
 * screens.md). The state is always written out, never conveyed by color alone (principle IX).
 * Contrast of the text on its background: Abierto 7.69, Por pagar 5.20, Vencido 6.05, Pagado
 * 5.40 (all ≥ 4.5:1, WCAG AA).
 */
const variants: Record<
  StatementStatus,
  { label: string; text: ColorToken; background: ColorToken; border: ColorToken }
> = {
  open: { label: 'Abierto', text: 'textSecondary', background: 'surface', border: 'border' },
  due: { label: 'Por pagar', text: 'warning', background: 'warningSoft', border: 'warningSoft' },
  overdue: { label: 'Vencido', text: 'danger', background: 'dangerSoft', border: 'dangerSoft' },
  paid: { label: 'Pagado', text: 'success', background: 'successSoft', border: 'successSoft' },
};

export function statusLabel(status: StatementStatus): string {
  return variants[status].label;
}

export function StatusChip({ status }: { status: StatementStatus }) {
  const variant = variants[status];
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${variant.label}`}
      style={[
        styles.chip,
        { backgroundColor: colors[variant.background], borderColor: colors[variant.border] },
      ]}
    >
      <Text variant="caption" color={variant.text}>
        {variant.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
