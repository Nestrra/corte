import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { ApiError, errorText, STATEMENT_NOT_FOUND_TEXT } from '../../../api/errors';
import {
  getStatement,
  payStatement,
  statementKeys,
  unpayStatement,
  type StatementDetail,
} from '../../../api/statements';
import { Button } from '../../../components/Button';
import { InstallmentRow } from '../../../components/InstallmentRow';
import { ListPanel } from '../../../components/ListPanel';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { statementAmountText } from '../../../components/StatementRow';
import { StatusChip } from '../../../components/StatusChip';
import { Text } from '../../../components/Text';
import { formatLongDate } from '../../../features/dates';
import { invalidateCardLedger } from '../../../features/ledger-cache';
import { formatCop } from '../../../features/money';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { colors, layout, radius, spacing } from '../../../theme';

function Summary({ statement }: { statement: StatementDetail }) {
  const { paidAt, paidAmount } = statement;
  const differs = paidAmount !== null && paidAmount !== statement.total;
  return (
    <View style={styles.summary}>
      <StatusChip status={statement.status} />
      <View accessible accessibilityLabel={`Corte: ${formatLongDate(statement.cutoffDate)}`}>
        <Text variant="secondary" color="textSecondary">
          Corte
        </Text>
        <Text variant="bodyStrong">{formatLongDate(statement.cutoffDate)}</Text>
      </View>
      <View
        accessible
        accessibilityLabel={`Fecha límite de pago: ${formatLongDate(statement.dueDate)}`}
      >
        <Text variant="secondary" color="textSecondary">
          Fecha límite de pago
        </Text>
        <Text variant="bodyStrong">{formatLongDate(statement.dueDate)}</Text>
      </View>
      <View accessible accessibilityLabel={`A pagar: ${statementAmountText(statement)}`}>
        <Text variant="secondary" color="textSecondary">
          A pagar{statement.hasInterest ? ' (estimado)' : ''}
        </Text>
        <Text variant="amount" style={styles.tabular}>
          {formatCop(statement.total)}
        </Text>
      </View>
      {paidAt !== null && paidAmount !== null ? (
        <View style={styles.paid} accessibilityLiveRegion="polite">
          <Text variant="bodyStrong" color="success">
            Pagado el {formatLongDate(paidAt)} · {formatCop(paidAmount)}
          </Text>
          {differs ? (
            <Text variant="secondary" color="textSecondary">
              Pagaste {formatCop(paidAmount)}; con los cambios suma {formatCop(statement.total)}.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Statement detail (spec 003 US3, US4): installments, pay and undo the payment. */
export default function StatementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: statementKeys.detail(id), queryFn: () => getStatement(id) });
  useRefetchOnFocus(detail.refetch);

  const refresh = async () => {
    if (detail.data) await invalidateCardLedger(queryClient, detail.data.cardId);
  };
  const pay = useMutation({ mutationFn: () => payStatement(id), onSuccess: refresh });
  const unpay = useMutation({ mutationFn: () => unpayStatement(id), onSuccess: refresh });

  if (detail.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando extracto" />
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
              {STATEMENT_NOT_FOUND_TEXT}
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

  const statement = detail.data;
  const busy = pay.isPending || unpay.isPending;
  const mutationError = pay.error ?? unpay.error;

  const confirmPay = () =>
    Alert.alert(
      'Marcar como pagado',
      `Se registrará el pago de ${statementAmountText(statement)} con la fecha de hoy.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Marcar pagado', onPress: () => pay.mutate() },
      ],
    );
  const confirmUnpay = () =>
    Alert.alert('Deshacer pago', 'El extracto vuelve al estado que le corresponde por fechas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Deshacer pago', style: 'destructive', onPress: () => unpay.mutate() },
    ]);

  return (
    <Screen edges={['bottom']}>
      <Summary statement={statement} />

      {statement.installments.length > 0 ? (
        <ListPanel>
          {statement.installments.map((installment) => (
            <InstallmentRow
              key={`${installment.purchaseId}-${installment.number}`}
              title={installment.concept}
              position={`${installment.number} de ${installment.purchaseInstallmentCount}`}
              principal={installment.principal}
              interest={installment.interest}
            />
          ))}
        </ListPanel>
      ) : (
        <Text color="textSecondary">Este extracto ya no tiene cuotas.</Text>
      )}

      {mutationError ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {errorText(mutationError)}
        </Text>
      ) : null}

      {statement.status === 'due' || statement.status === 'overdue' ? (
        <Button label="Marcar como pagado" onPress={confirmPay} loading={pay.isPending} />
      ) : statement.status === 'paid' ? (
        <Button
          label="Deshacer pago"
          variant="secondary"
          onPress={confirmUnpay}
          loading={unpay.isPending}
          disabled={busy}
        />
      ) : (
        <View style={styles.hint}>
          <Text variant="secondary" color="textSecondary">
            Podrás marcarlo pagado después del corte.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  paid: { gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  hint: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
});
