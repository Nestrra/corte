import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  archiveCard,
  cardKeys,
  getCard,
  restoreCard,
  type CardDetail,
} from '../../../../api/cards';
import { ApiError, errorText } from '../../../../api/errors';
import { Button } from '../../../../components/Button';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { Text } from '../../../../components/Text';
import { CreditCardView } from '../../../../components/CreditCardView';
import { daysLeftLabel, formatLongDate } from '../../../../features/dates';
import { formatCop } from '../../../../features/money';
import { formatRate } from '../../../../features/rate';
import { useRefetchOnFocus } from '../../../../features/use-refetch-on-focus';
import { colors, interaction, layout, radius, spacing } from '../../../../theme';

function daysText(days: number): string {
  return days === 1 ? '1 día antes' : `${days} días antes`;
}

/** Label and value on one line; amounts use tabular figures (FR-024). */
function DataRow({
  label,
  value,
  amount = false,
}: {
  label: string;
  value: string;
  amount?: boolean;
}) {
  return (
    <View style={styles.dataRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text color="textSecondary">{label}</Text>
      <Text variant="bodyStrong" style={amount ? styles.tabular : undefined}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Debt and use of the cycle budget (spec 003 FR-023, FR-024). Interest never counts in the debt;
 * a budget above 100% is said in text, not only with color (principle IX).
 */
function LedgerPanel({ card }: { card: CardDetail }) {
  const { amount, percent } = card.cycleBudgetUsage;
  const budgetValue = `${percent}% · ${formatCop(amount)} de ${formatCop(card.cycleBudget)}`;
  const overBudget = percent >= 100;
  return (
    <View style={styles.panel}>
      <DataRow label="Deuda total" value={formatCop(card.totalDebt)} amount />
      <View style={styles.divider} />
      <View
        style={styles.cycleRow}
        accessible
        accessibilityLabel={`Tope del ciclo, estimado: ${budgetValue}${overBudget ? '. Superaste el tope' : ''}`}
      >
        {/* The amount may include estimated interest (principle IV). */}
        <Text variant="secondary" color="textSecondary">
          Tope del ciclo (estimado)
        </Text>
        <Text variant="bodyStrong" style={styles.tabular}>
          {budgetValue}
        </Text>
        {overBudget ? (
          <Text variant="secondary" color="danger">
            Superaste el tope
          </Text>
        ) : null}
      </View>
      <View style={styles.divider} />
      <DataRow
        label="Tasa"
        value={card.annualRate === null ? 'Sin tasa' : formatRate(card.annualRate)}
      />
    </View>
  );
}

function CyclePanel({ card }: { card: CardDetail }) {
  const { today, nextCutoff, nextCutoffDue } = card.cycle;
  const rows = [
    { label: 'Próximo corte', date: nextCutoff },
    { label: 'Fecha límite de ese corte', date: nextCutoffDue },
  ];
  return (
    <View style={styles.panel}>
      {rows.map(({ label, date }, index) => {
        const value = `${formatLongDate(date)} · ${daysLeftLabel(today, date)}`;
        return (
          <View key={label}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.cycleRow} accessible accessibilityLabel={`${label}: ${value}`}>
              <Text variant="secondary" color="textSecondary">
                {label}
              </Text>
              <Text variant="bodyStrong">{formatLongDate(date)}</Text>
              <Text variant="secondary" color="primaryStrong">
                {daysLeftLabel(today, date)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Card detail (spec US4–US6): cycle in the user's time zone, data, edit, archive and restore. */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: cardKeys.detail(id), queryFn: () => getCard(id) });
  // The time zone or the day may have changed while away (contracts/screens.md → Comportamiento).
  useRefetchOnFocus(detail.refetch);

  const afterChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: cardKeys.all }),
      queryClient.invalidateQueries({ queryKey: cardKeys.detail(id) }),
    ]);
    router.dismissTo('/cards');
  };
  const archive = useMutation({ mutationFn: () => archiveCard(id), onSuccess: afterChange });
  const restore = useMutation({ mutationFn: () => restoreCard(id), onSuccess: afterChange });

  const confirmArchive = () =>
    Alert.alert(
      'Archivar tarjeta',
      'Dejará de aparecer en el carrusel. No se borra y puedes restaurarla desde "Archivadas".',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: () => archive.mutate() },
      ],
    );

  if (detail.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjeta" />
      </Screen>
    );
  }

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.code === 'NOT_FOUND';
    return (
      <Screen edges={['bottom']}>
        {notFound ? (
          <>
            <Text variant="section" accessibilityRole="header">
              No encontramos esa tarjeta
            </Text>
            <Button label="Volver" variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <QueryError
            error={detail.error}
            onRetry={() => void detail.refetch()}
            retrying={detail.isFetching}
          />
        )}
      </Screen>
    );
  }

  const card = detail.data;
  const isArchived = card.archivedAt !== null;
  const mutationError = archive.error ?? restore.error;

  return (
    <Screen edges={['bottom']}>
      {isArchived ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text variant="bodyStrong" color="warning">
            Tarjeta archivada
          </Text>
          <Text variant="secondary" color="textSecondary">
            No aparece en el carrusel. Restáurala para editarla.
          </Text>
        </View>
      ) : null}

      <View style={styles.cardWrap}>
        <CreditCardView card={card} width={screenWidth - 2 * layout.screenMargin} />
      </View>

      <CyclePanel card={card} />

      <LedgerPanel card={card} />

      <View style={styles.actions}>
        {isArchived ? null : (
          <Button
            label="Registrar compra"
            onPress={() => router.push({ pathname: '/card/[id]/purchases/new', params: { id } })}
          />
        )}
        <View style={styles.row}>
          <View style={styles.cell}>
            <Button
              label="Compras"
              variant="secondary"
              onPress={() => router.push({ pathname: '/card/[id]/purchases', params: { id } })}
            />
          </View>
          <View style={styles.cell}>
            <Button
              label="Extractos"
              variant="secondary"
              onPress={() => router.push({ pathname: '/card/[id]/statements', params: { id } })}
            />
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <DataRow label="Cupo total" value={formatCop(card.creditLimit)} amount />
        <View style={styles.divider} />
        <DataRow label="Tope por ciclo" value={formatCop(card.cycleBudget)} amount />
        <View style={styles.divider} />
        <DataRow label="Recordar corte" value={daysText(card.remindCutoffDays)} />
        <View style={styles.divider} />
        <DataRow label="Recordar pago" value={daysText(card.remindDueDays)} />
      </View>

      {mutationError ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {errorText(mutationError)}
        </Text>
      ) : null}

      {isArchived ? (
        <Button label="Restaurar" onPress={() => restore.mutate()} loading={restore.isPending} />
      ) : (
        <View style={styles.actions}>
          <Button
            label="Editar"
            variant="secondary"
            onPress={() => router.push({ pathname: '/card/[id]/edit', params: { id } })}
            disabled={archive.isPending}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Archivar"
            accessibilityState={{ disabled: archive.isPending, busy: archive.isPending }}
            disabled={archive.isPending}
            onPress={confirmArchive}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            {archive.isPending ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text variant="bodyStrong" color="danger">
                Archivar
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardWrap: { alignItems: 'center' },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cycleRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  dataRow: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg },
  actions: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
  textButton: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: interaction.pressedOpacity },
});
