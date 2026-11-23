import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { cardKeys, getCard, updateCard, type CardInput } from '../../../../api/cards';
import { CardForm } from '../../../../components/CardForm';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { cardToFormValues } from '../../../../features/card-schema';
import { invalidateCardLedger } from '../../../../features/ledger-cache';
import { colors } from '../../../../theme';

/** "Editar tarjeta" (spec US5): the same form with the current values; sends the full form. */
export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: cardKeys.detail(id), queryFn: () => getCard(id) });

  const onSubmit = async (input: CardInput) => {
    await updateCard(id, input);
    // A new cutoff or due day reschedules the open statements (spec 003 FR-021, SC-005).
    await invalidateCardLedger(queryClient, id);
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      {detail.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjeta" />
      ) : detail.isError ? (
        <QueryError
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      ) : (
        <CardForm
          defaultValues={cardToFormValues(detail.data)}
          onSubmit={onSubmit}
          onCancel={() => router.back()}
        />
      )}
    </Screen>
  );
}
