import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { ApiError, errorText } from '../../../../api/errors';
import { getOccurrence, recurringKeys, unpayOccurrence } from '../../../../api/recurring';
import { Button } from '../../../../components/Button';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { StatusChip } from '../../../../components/StatusChip';
import { Text } from '../../../../components/Text';
import { formatLongDate } from '../../../../features/dates';
import { formatCop } from '../../../../features/money';
import { invalidateRecurring } from '../../../../features/recurring-cache';
import { useRefetchOnAppActive } from '../../../../features/use-refetch-on-app-active';
import { useRefetchOnFocus } from '../../../../features/use-refetch-on-focus';
import { colors, radius, spacing } from '../../../../theme';

/**
 * "Pago del mes" (spec 005 US3, US7; FR-016; contracts/screens.md): one occurrence with its date,
 * status and amounts; mark it paid (sheet) or undo it. The paid history of a deleted payment is
 * shown but cannot be undone.
 */
export default function OccurrenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: recurringKeys.occurrence(id),
    queryFn: () => getOccurrence(id),
  });
  useRefetchOnFocus(detail.refetch);
  useRefetchOnAppActive(detail.refetch);
  const unpay = useMutation({
    mutationFn: () => unpayOccurrence(id),
    onSuccess: () => invalidateRecurring(queryClient),
  });

  if (detail.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pago" />
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
              No encontramos ese pago
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

  const occurrence = detail.data;
  const paid = occurrence.paidAt !== null && occurrence.paidAmount !== null;
  const confirmUnpay = () =>
    Alert.alert('Deshacer pago', 'El pago vuelve a Pendiente o Vencido según su fecha.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Deshacer pago', style: 'destructive', onPress: () => unpay.mutate() },
    ]);

  return (
    <Screen edges={['bottom']}>
      <View style={styles.summary}>
        <Text variant="section" accessibilityRole="header">
          {occurrence.name}
        </Text>
        <StatusChip status={occurrence.status} />
        <View accessible accessibilityLabel={`Vence el ${formatLongDate(occurrence.dueDate)}`}>
          <Text variant="secondary" color="textSecondary">
            Vence
          </Text>
          <Text variant="bodyStrong">{formatLongDate(occurrence.dueDate)}</Text>
        </View>
        <View accessible accessibilityLabel={`Esperado ${formatCop(occurrence.expectedAmount)}`}>
          <Text variant="secondary" color="textSecondary">
            Esperado
          </Text>
          <Text variant="amount" numberOfLines={1} adjustsFontSizeToFit style={styles.tabular}>
            {formatCop(occurrence.expectedAmount)}
          </Text>
        </View>
        {paid ? (
          <View style={styles.paid} accessibilityLiveRegion="polite">
            <Text variant="bodyStrong" color="success" style={styles.tabular}>
              Pagado {formatCop(occurrence.paidAmount ?? 0)} el{' '}
              {formatLongDate(occurrence.paidAt ?? '')}
            </Text>
          </View>
        ) : null}
        {occurrence.paymentDeleted ? (
          <Text color="textSecondary">Este pago fue eliminado; lo pagado se conserva.</Text>
        ) : null}
      </View>

      {unpay.error ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {errorText(unpay.error)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {!paid ? (
          <Button
            label="Marcar pagado"
            onPress={() => router.push({ pathname: '/occurrence/[id]/pay', params: { id } })}
          />
        ) : !occurrence.paymentDeleted ? (
          <Button
            label="Deshacer pago"
            variant="secondary"
            onPress={confirmUnpay}
            loading={unpay.isPending}
          />
        ) : null}
        {!occurrence.paymentDeleted ? (
          <Button
            label="Ver pago"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/recurring/[id]',
                params: { id: occurrence.recurringPaymentId },
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  paid: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  actions: { gap: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
});
