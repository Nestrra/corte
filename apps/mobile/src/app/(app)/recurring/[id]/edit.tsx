import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { getRecurring, recurringKeys, updateRecurring } from '../../../../api/recurring';
import { getSummary, summaryKeys } from '../../../../api/summary';
import { QueryError } from '../../../../components/QueryError';
import { RecurringForm } from '../../../../components/RecurringForm';
import { Screen } from '../../../../components/Screen';
import { invalidateRecurring } from '../../../../features/recurring-cache';
import { recurringToFormValues, toUpdateRecurring } from '../../../../features/recurring-schema';
import { colors } from '../../../../theme';

/**
 * "Editar pago" (spec 005 US5; FR-004; contracts/screens.md): sends only what changed; amount,
 * frequency and date apply from today on and paid occurrences never change.
 */
export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: recurringKeys.detail(id), queryFn: () => getRecurring(id) });
  const summary = useQuery({ queryKey: summaryKeys.all, queryFn: getSummary });

  if (detail.isPending || summary.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pago" />
      </Screen>
    );
  }
  const error = detail.error ?? summary.error;
  if (error || !detail.data || !summary.data) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={error}
          onRetry={() => void (detail.isError ? detail.refetch() : summary.refetch())}
          retrying={detail.isFetching || summary.isFetching}
        />
      </Screen>
    );
  }

  const today = summary.data.today;
  const initial = recurringToFormValues(detail.data, today);
  return (
    <Screen edges={['bottom']}>
      <RecurringForm
        mode="edit"
        defaultValues={initial}
        today={today}
        submitLabel="Guardar cambios"
        note="Los cambios de monto y fecha aplican desde hoy; lo pagado no cambia."
        onSubmit={async (values) => {
          const input = toUpdateRecurring(values, initial);
          if (Object.keys(input).length > 0) {
            await updateRecurring(id, input);
            await invalidateRecurring(queryClient);
          }
          router.back();
        }}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
