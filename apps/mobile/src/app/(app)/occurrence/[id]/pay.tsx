import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { getOccurrence, payOccurrence, recurringKeys } from '../../../../api/recurring';
import { PayOccurrenceForm } from '../../../../components/PayOccurrenceForm';
import { QueryError } from '../../../../components/QueryError';
import { Text } from '../../../../components/Text';
import { invalidateRecurring } from '../../../../features/recurring-cache';
import { colors, layout, spacing } from '../../../../theme';

/**
 * Sheet "Marcar pagado" (spec 005 US3; research.md R10): a native form sheet with the amount
 * prefilled. Closes on confirm, on "Cancelar" or with the native gesture.
 */
export default function PayOccurrenceSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: recurringKeys.occurrence(id),
    queryFn: () => getOccurrence(id),
  });

  return (
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {detail.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pago" />
      ) : detail.isError ? (
        <QueryError
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      ) : (
        <>
          <Text variant="section" accessibilityRole="header">
            Marcar pagado · {detail.data.name}
          </Text>
          <PayOccurrenceForm
            expectedAmount={detail.data.expectedAmount}
            onSubmit={async (amount) => {
              await payOccurrence(id, amount);
              await invalidateRecurring(queryClient);
              router.back();
            }}
            onCancel={() => router.back()}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: layout.sectionGap,
    gap: spacing.lg,
  },
});
