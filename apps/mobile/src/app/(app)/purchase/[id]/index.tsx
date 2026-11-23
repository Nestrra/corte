import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { cardKeys, getCard } from '../../../../api/cards';
import { ApiError, errorText, PURCHASE_NOT_FOUND_TEXT } from '../../../../api/errors';
import {
  deletePurchase,
  getPurchase,
  purchaseKeys,
  type PurchaseDetail,
} from '../../../../api/purchases';
import { Button } from '../../../../components/Button';
import { InstallmentRow } from '../../../../components/InstallmentRow';
import { ListPanel } from '../../../../components/ListPanel';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { Text } from '../../../../components/Text';
import { formatLongDate, formatShortDate } from '../../../../features/dates';
import { invalidateCardLedger } from '../../../../features/ledger-cache';
import { formatCop } from '../../../../features/money';
import { formatRate } from '../../../../features/rate';
import { useRefetchOnFocus } from '../../../../features/use-refetch-on-focus';
import { colors, interaction, layout, radius, spacing } from '../../../../theme';

function rateText(purchase: PurchaseDetail): string {
  if (purchase.noInterest) return 'Sin intereses';
  if (purchase.annualRate === null || purchase.annualRate === 0) return 'Sin tasa';
  return `${formatRate(purchase.annualRate)} (estimado)`;
}

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

/** Purchase detail with its installment plan (spec 003 US6, FR-013); edit and delete. */
export default function PurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: purchaseKeys.detail(id), queryFn: () => getPurchase(id) });
  const cardId = detail.data?.cardId;
  const card = useQuery({
    queryKey: cardKeys.detail(cardId ?? ''),
    queryFn: () => getCard(cardId ?? ''),
    enabled: cardId !== undefined,
  });
  useRefetchOnFocus(detail.refetch);

  const remove = useMutation({
    mutationFn: () => deletePurchase(id),
    onSuccess: async () => {
      // Leave first: invalidating while this screen is mounted would refetch the deleted purchase.
      router.back();
      queryClient.removeQueries({ queryKey: purchaseKeys.detail(id) });
      if (cardId) await invalidateCardLedger(queryClient, cardId);
    },
  });

  if (detail.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando compra" />
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
              {PURCHASE_NOT_FOUND_TEXT}
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

  const purchase = detail.data;
  const editable = card.data?.archivedAt === null;
  const confirmDelete = () =>
    Alert.alert('Borrar compra', 'Se borran la compra y sus cuotas. Los extractos se recalculan.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => remove.mutate() },
    ]);

  return (
    <Screen edges={['bottom']}>
      <Text variant="section" accessibilityRole="header">
        {purchase.concept}
      </Text>

      <ListPanel>
        <DataRow label="Valor" value={formatCop(purchase.amount)} amount />
        <DataRow label="Fecha" value={formatLongDate(purchase.purchaseDate)} />
        <DataRow
          label="Cuotas"
          value={
            purchase.installmentCount === 1 ? '1 cuota' : `${purchase.installmentCount} cuotas`
          }
        />
        <DataRow label="Interés" value={rateText(purchase)} />
      </ListPanel>

      <Text variant="bodyStrong" accessibilityRole="header">
        Plan de cuotas
      </Text>
      <ListPanel>
        {purchase.installments.map((installment) => (
          <InstallmentRow
            key={installment.number}
            title={`Corte ${formatShortDate(installment.cutoffDate)} · paga ${formatShortDate(installment.dueDate)}`}
            position={`${installment.number} de ${purchase.installmentCount}`}
            principal={installment.principal}
            interest={installment.interest}
            status={installment.statementStatus}
          />
        ))}
      </ListPanel>

      {remove.error ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {errorText(remove.error)}
        </Text>
      ) : null}

      {editable ? (
        <View style={styles.actions}>
          <Button
            label="Editar"
            variant="secondary"
            onPress={() => router.push({ pathname: '/purchase/[id]/edit', params: { id } })}
            disabled={remove.isPending}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar compra"
            accessibilityState={{ disabled: remove.isPending, busy: remove.isPending }}
            disabled={remove.isPending}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            {remove.isPending ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text variant="bodyStrong" color="danger">
                Borrar
              </Text>
            )}
          </Pressable>
        </View>
      ) : card.data ? (
        <View style={styles.notice}>
          <Text variant="secondary" color="textSecondary">
            La tarjeta está archivada: sus compras son de solo lectura.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  actions: { gap: spacing.md },
  textButton: { minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: interaction.pressedOpacity },
  notice: { backgroundColor: colors.warningSoft, borderRadius: radius.panel, padding: spacing.lg },
});
