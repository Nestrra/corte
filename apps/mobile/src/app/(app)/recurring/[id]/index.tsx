import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { ApiError, errorText, RECURRING_NOT_FOUND_TEXT } from '../../../../api/errors';
import {
  deleteRecurring,
  getRecurring,
  pauseRecurring,
  recurringKeys,
  resumeRecurring,
} from '../../../../api/recurring';
import { Button } from '../../../../components/Button';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { Text } from '../../../../components/Text';
import { formatLongDate } from '../../../../features/dates';
import { formatCop } from '../../../../features/money';
import { frequencyText } from '../../../../features/months';
import { invalidateRecurring } from '../../../../features/recurring-cache';
import { useRefetchOnAppActive } from '../../../../features/use-refetch-on-app-active';
import { useRefetchOnFocus } from '../../../../features/use-refetch-on-focus';
import { colors, spacing } from '../../../../theme';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyStrong" style={styles.tabular}>
        {value}
      </Text>
    </View>
  );
}

/** "2 días antes", "1 día antes" or "el mismo día" (spec 006). */
function reminderText(days: number): string {
  if (days === 0) return 'El mismo día';
  return days === 1 ? '1 día antes' : `${days} días antes`;
}

/**
 * "Pago" (spec 005 US4 – US7; contracts/screens.md): a recurring payment with its next due date
 * and the actions edit, pause or resume, and delete (with confirmation; paid history is kept).
 */
export default function RecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: recurringKeys.detail(id), queryFn: () => getRecurring(id) });
  useRefetchOnFocus(detail.refetch);
  useRefetchOnAppActive(detail.refetch);

  const refresh = () => invalidateRecurring(queryClient);
  const pause = useMutation({ mutationFn: () => pauseRecurring(id), onSuccess: refresh });
  const resume = useMutation({ mutationFn: () => resumeRecurring(id), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => deleteRecurring(id),
    onSuccess: async () => {
      await refresh();
      router.back();
    },
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
              {RECURRING_NOT_FOUND_TEXT}
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

  const payment = detail.data;
  const paused = payment.status === 'paused';
  const busy = pause.isPending || resume.isPending || remove.isPending;
  const mutationError = pause.error ?? resume.error ?? remove.error;

  const confirmDelete = () =>
    Alert.alert(
      `¿Eliminar ${payment.name}?`,
      'Se borran sus pagos pendientes y se conserva lo que ya pagaste.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate() },
      ],
    );

  return (
    <Screen edges={['bottom']}>
      <View style={styles.summary}>
        <Text variant="section" accessibilityRole="header">
          {payment.name}
        </Text>
        <Field label="Monto esperado" value={formatCop(payment.amount)} />
        <Field label="Frecuencia" value={frequencyText(payment)} />
        <Field label="Estado" value={paused ? 'Pausado' : 'Activo'} />
        <Field label="Recordatorio" value={reminderText(payment.remindDays)} />
        {payment.nextDueDate !== null ? (
          <Field label="Próximo vencimiento" value={formatLongDate(payment.nextDueDate)} />
        ) : (
          <Text color="textSecondary">Pausado: no genera pagos nuevos.</Text>
        )}
      </View>

      {mutationError ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {errorText(mutationError)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Editar"
          onPress={() => router.push({ pathname: '/recurring/[id]/edit', params: { id } })}
          disabled={busy}
        />
        {paused ? (
          <Button
            label="Reanudar"
            variant="secondary"
            onPress={() => resume.mutate()}
            loading={resume.isPending}
            disabled={busy}
          />
        ) : (
          <Button
            label="Pausar"
            variant="secondary"
            onPress={() => pause.mutate()}
            loading={pause.isPending}
            disabled={busy}
          />
        )}
        <Button
          label="Eliminar"
          variant="danger"
          onPress={confirmDelete}
          loading={remove.isPending}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  actions: { gap: spacing.md },
  tabular: { fontVariant: ['tabular-nums'] },
});
