import type { MonthKey } from '@corte/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { getMonth, recurringKeys } from '../../../api/recurring';
import { getSummary, summaryKeys } from '../../../api/summary';
import { Button } from '../../../components/Button';
import { MonthNavigator } from '../../../components/MonthNavigator';
import { MonthOverview } from '../../../components/MonthOverview';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { currentMonth } from '../../../features/months';
import { useRefetchOnAppActive } from '../../../features/use-refetch-on-app-active';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { colors } from '../../../theme';

/**
 * Pagos tab (spec 005 US4; FR-018, FR-019; contracts/screens.md): one month at a time, starting at
 * the current one (from the server's "today"), with the same overview as the home, and access to
 * "Mis pagos". While another month loads, the previous one stays on screen.
 */
export default function PaymentsScreen() {
  const summary = useQuery({ queryKey: summaryKeys.all, queryFn: getSummary });
  const [chosen, setChosen] = useState<MonthKey | null>(null);
  const month = chosen ?? (summary.data ? currentMonth(summary.data.today) : null);
  const view = useQuery({
    queryKey: recurringKeys.month(month ?? ''),
    queryFn: () => getMonth(month ?? ''),
    enabled: month !== null,
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(view.refetch);
  useRefetchOnAppActive(view.refetch);
  useRefetchOnAppActive(summary.refetch);

  const error = summary.error ?? (view.data ? null : view.error);

  return (
    <Screen edges={['top']}>
      <Text variant="title" accessibilityRole="header">
        Pagos
      </Text>

      {error ? (
        <QueryError
          error={error}
          onRetry={() => void (summary.isError ? summary.refetch() : view.refetch())}
          retrying={summary.isFetching || view.isFetching}
        />
      ) : !view.data || month === null ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pagos" />
      ) : (
        <>
          <MonthNavigator month={month} bounds={view.data.bounds} onChange={setChosen} />
          <MonthOverview view={view.data} />
        </>
      )}

      <Button label="Mis pagos" variant="secondary" onPress={() => router.push('/recurring')} />
    </Screen>
  );
}
