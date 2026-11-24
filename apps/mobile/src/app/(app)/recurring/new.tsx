import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { createRecurring } from '../../../api/recurring';
import { getSummary, summaryKeys } from '../../../api/summary';
import { QueryError } from '../../../components/QueryError';
import { RecurringForm } from '../../../components/RecurringForm';
import { Screen } from '../../../components/Screen';
import { invalidateRecurring } from '../../../features/recurring-cache';
import { emptyRecurringForm, toCreateRecurring } from '../../../features/recurring-schema';
import { colors } from '../../../theme';

/**
 * "Nuevo pago" (spec 005 US1; contracts/screens.md). "Today" comes from the summary, fetched when
 * it is not cached (e.g. opened from "Mis pagos"). On save, back to where it was opened.
 */
export default function NewRecurringScreen() {
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: summaryKeys.all, queryFn: getSummary });

  if (summary.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando" />
      </Screen>
    );
  }
  if (summary.isError) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={summary.error}
          onRetry={() => void summary.refetch()}
          retrying={summary.isFetching}
        />
      </Screen>
    );
  }

  const today = summary.data.today;
  return (
    <Screen edges={['bottom']}>
      <RecurringForm
        mode="create"
        defaultValues={emptyRecurringForm(today)}
        today={today}
        submitLabel="Guardar pago"
        onSubmit={async (values) => {
          await createRecurring(toCreateRecurring(values));
          await invalidateRecurring(queryClient);
          router.back();
        }}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
