import { BUDGET_DANGER_PERCENT } from '@corte/domain';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Simulation } from '../api/purchases';
import { errorText } from '../api/errors';
import { formatLongDate, formatShortDate } from '../features/dates';
import { formatCop } from '../features/money';
import { colors, interaction, radius, spacing } from '../theme';
import { Button } from './Button';
import { InstallmentRow } from './InstallmentRow';
import { ListPanel } from './ListPanel';
import { ProgressBar } from './ProgressBar';
import { StatusChip } from './StatusChip';
import { Text } from './Text';

/** Rows only re-render when their own values change: 72 rows must not slow typing (FR-007). */
const PlanRow = memo(InstallmentRow);

export interface SimulationPanelProps {
  /** Last simulation received, if any. */
  simulation: Simulation | undefined;
  /** What is missing or invalid in the form; when set, no figures are shown. */
  missing: string | null;
  /** The shown simulation is for earlier values: dim it and say "Actualizando…". */
  stale: boolean;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}

function Warning({ text }: { text: string }) {
  return (
    <View style={styles.warning} accessibilityLiveRegion="polite">
      <Text variant="bodyStrong" color="danger">
        {text}
      </Text>
    </View>
  );
}

function Figure({ label, value, dimmed }: { label: string; value: string; dimmed: boolean }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text color="textSecondary" style={dimmed && styles.dimmed}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={[styles.tabular, dimmed && styles.dimmed]}>
        {value}
      </Text>
    </View>
  );
}

function Result({ simulation, stale }: { simulation: Simulation; stale: boolean }) {
  const first = simulation.installments[0];
  const usage = simulation.cycleBudgetUsage;
  const changesBudget = usage.amountAfter !== usage.amountBefore;
  const overBudget = usage.percentAfter >= BUDGET_DANGER_PERCENT;
  const overCredit = simulation.availableCredit.after < 0;
  const count = simulation.installments.length;

  return (
    <>
      {first ? (
        <View style={styles.first}>
          <Text style={stale && styles.dimmed}>
            Primera cuota en el corte del {formatLongDate(first.cutoffDate)} · se paga el{' '}
            {formatLongDate(first.dueDate)}
          </Text>
          {first.statementStatus === 'open' ? null : <StatusChip status={first.statementStatus} />}
        </View>
      ) : null}

      <View
        style={[styles.budget, stale && styles.dimmed]}
        accessible
        accessibilityLabel={
          changesBudget
            ? `Tope del ciclo, estimado: pasa de ${usage.percentBefore} a ${usage.percentAfter} por ciento, ${formatCop(usage.amountAfter)} de ${formatCop(simulation.cycleBudget)}`
            : `Tope del ciclo: no cambia, sigue en ${usage.percentBefore} por ciento`
        }
      >
        <View style={styles.figure}>
          <Text color="textSecondary">Tope del ciclo (estimado)</Text>
          <Text variant="bodyStrong" style={styles.tabular}>
            {usage.percentBefore}% → {usage.percentAfter}%
          </Text>
        </View>
        <ProgressBar
          percent={usage.percentAfter}
          accessibilityLabel={`Tope del ciclo: ${usage.percentAfter} por ciento`}
        />
        <Text variant="secondary" color="textSecondary" style={styles.tabular}>
          {changesBudget
            ? `${formatCop(usage.amountAfter)} de ${formatCop(simulation.cycleBudget)}`
            : 'No cambia el tope de este ciclo'}
        </Text>
      </View>

      <Figure
        label="Cupo disponible después"
        value={formatCop(simulation.availableCredit.after)}
        dimmed={stale}
      />
      <Figure
        label="Intereses estimados"
        value={simulation.totalInterest > 0 ? formatCop(simulation.totalInterest) : 'Sin intereses'}
        dimmed={stale}
      />

      {overBudget ? <Warning text="Con esta compra superas el tope del ciclo" /> : null}
      {overCredit ? <Warning text="Con esta compra superas tu cupo disponible" /> : null}

      <Text variant="bodyStrong" accessibilityRole="header">
        Plan de cuotas
      </Text>
      <ListPanel>
        {simulation.installments.map((installment) => (
          <PlanRow
            key={installment.number}
            title={`Corte ${formatShortDate(installment.cutoffDate)} · paga ${formatShortDate(installment.dueDate)}`}
            position={`${installment.number} de ${count}`}
            principal={installment.principal}
            interest={installment.interest}
            status={installment.statementStatus}
            dimmed={stale}
          />
        ))}
      </ListPanel>
    </>
  );
}

/**
 * Live simulation of the purchase being registered (spec 004 US1; contracts/screens.md →
 * SimulationPanel). Nothing is saved. While the values are recalculated the last result stays
 * visible and dimmed, without a spinner; warnings and status chips are never dimmed (AA).
 */
export function SimulationPanel({
  simulation,
  missing,
  stale,
  error,
  onRetry,
  retrying,
}: SimulationPanelProps) {
  const updating = missing === null && simulation !== undefined && stale;

  return (
    <View style={styles.panel} accessibilityState={{ busy: updating }}>
      <View style={styles.header}>
        <Text variant="bodyStrong" accessibilityRole="header">
          Si la registras
        </Text>
        {updating ? (
          <Text variant="secondary" color="textSecondary" accessibilityLiveRegion="polite">
            Actualizando…
          </Text>
        ) : null}
      </View>

      {missing !== null ? (
        <Text color="textSecondary">{missing}</Text>
      ) : simulation === undefined ? (
        error ? null : (
          <Text color="textSecondary" accessibilityLiveRegion="polite">
            Calculando…
          </Text>
        )
      ) : (
        <Result simulation={simulation} stale={stale} />
      )}

      {missing === null && error ? (
        <View style={styles.error}>
          <Text color="danger" accessibilityLiveRegion="polite">
            No pudimos simular la compra. {errorText(error)}
          </Text>
          <Button label="Reintentar" variant="secondary" onPress={onRetry} loading={retrying} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  first: { gap: spacing.sm },
  budget: { gap: spacing.sm },
  figure: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  warning: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  error: { gap: spacing.sm },
  tabular: { fontVariant: ['tabular-nums'] },
  dimmed: { opacity: interaction.staleOpacity },
});
