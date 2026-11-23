import { BUDGET_DANGER_PERCENT, paymentUrgency, type PaymentUrgency } from '@corte/domain';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CardSummary, NextPayment } from '../api/summary';
import { formatLongDate } from '../features/dates';
import { daysLeftText, formatDayMonth } from '../features/days';
import { formatCop } from '../features/money';
import { colors, interaction, layout, radius, spacing, type ColorToken } from '../theme';
import { ListPanel } from './ListPanel';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

/**
 * Urgency of the next payment (spec 004 FR-016): background of the row and a chip that says it in
 * text. Contrast: warning on surface 5.43, danger on surface 6.57; texts on warningSoft ≥ 7.37 and
 * on dangerSoft ≥ 7.07 (WCAG AA).
 */
const urgencyStyles: Record<
  PaymentUrgency,
  { background: ColorToken; chip: { label: string; color: ColorToken } | null }
> = {
  normal: { background: 'surface', chip: null },
  soon: { background: 'warningSoft', chip: { label: 'Pronto', color: 'warning' } },
  overdue: { background: 'dangerSoft', chip: { label: 'Vencido', color: 'danger' } },
};

function Chip({ label, color }: { label: string; color: ColorToken }) {
  return (
    <View style={[styles.chip, { borderColor: colors[color] }]}>
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </View>
  );
}

/** A row of the panel; tappable when it leads somewhere (≥ 44). */
function Row({
  label,
  onPress,
  background = 'surface',
  children,
}: {
  label: string;
  onPress?: () => void;
  background?: ColorToken;
  children: ReactNode;
}) {
  const style = [styles.row, { backgroundColor: colors[background] }];
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function NextPaymentRow({ payment }: { payment: NextPayment | null }) {
  if (payment === null) {
    return (
      <Row label="Próximo pago: sin pagos pendientes">
        <Text color="textSecondary">Próximo pago</Text>
        <Text variant="bodyStrong">Sin pagos pendientes</Text>
      </Row>
    );
  }
  const urgency = paymentUrgency(payment.daysLeft, payment.status);
  const { background, chip } = urgencyStyles[urgency];
  const days = daysLeftText(payment.daysLeft);
  const label = [
    `Próximo pago: ${formatCop(payment.amount)}`,
    `paga hasta el ${formatLongDate(payment.dueDate)}`,
    days.toLowerCase(),
    chip?.label.toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Row
      label={label}
      background={background}
      onPress={() =>
        router.push({ pathname: '/statement/[id]', params: { id: payment.statementId } })
      }
    >
      <View style={styles.line}>
        <Text color="textSecondary">Próximo pago</Text>
        {chip ? <Chip label={chip.label} color={chip.color} /> : null}
      </View>
      {/* Large amounts shrink to fit one line instead of being cut (T037). */}
      <Text variant="amount" numberOfLines={1} adjustsFontSizeToFit>
        {formatCop(payment.amount)}
      </Text>
      <Text variant="secondary" color="textSecondary">
        Paga hasta {formatDayMonth(payment.dueDate)} · {days}
      </Text>
    </Row>
  );
}

/**
 * Summary of the card in front of the home carousel (spec 004 US2; docs/design-system.md →
 * CycleSummary): next payment, next cutoff and the current cycle against the budget. The header is
 * a polite live region, so screen readers say whose summary it is after each swipe (FR-018).
 */
export function CycleSummary({ summary }: { summary: CardSummary }) {
  const { card, nextPayment, nextCutoff, cycleBudgetUsage: usage } = summary;
  const over = usage.percent >= BUDGET_DANGER_PERCENT;
  const budgetText = `${usage.percent}% · ${formatCop(usage.amount)} de ${formatCop(card.cycleBudget)}`;
  const cutoffDays = daysLeftText(nextCutoff.daysLeft);

  return (
    <View style={styles.container}>
      <View accessibilityLiveRegion="polite">
        <Text variant="bodyStrong" accessibilityRole="header">
          Resumen de {card.name}
        </Text>
      </View>
      <ListPanel>
        <NextPaymentRow payment={nextPayment} />
        <Row
          label={`Próximo corte: ${formatLongDate(nextCutoff.cutoffDate)}, ${cutoffDays.toLowerCase()}`}
        >
          <Text color="textSecondary">Próximo corte</Text>
          <Text variant="bodyStrong">
            {formatDayMonth(nextCutoff.cutoffDate)} · {cutoffDays}
          </Text>
        </Row>
        <Row
          label={`Tope del ciclo, estimado: ${usage.percent} por ciento, ${formatCop(usage.amount)} de ${formatCop(card.cycleBudget)}${over ? ', superaste el tope' : ''}. Abre los extractos`}
          onPress={() =>
            router.push({ pathname: '/card/[id]/statements', params: { id: card.id } })
          }
        >
          <Text color="textSecondary">Tope del ciclo (estimado)</Text>
          <Text variant="bodyStrong" style={styles.tabular}>
            {budgetText}
          </Text>
          <ProgressBar
            percent={usage.percent}
            accessibilityLabel={`Tope del ciclo: ${usage.percent} por ciento`}
          />
          {over ? (
            <Text variant="secondary" color="danger">
              Superaste el tope
            </Text>
          ) : null}
        </Row>
      </ListPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: interaction.pressedOpacity },
});
