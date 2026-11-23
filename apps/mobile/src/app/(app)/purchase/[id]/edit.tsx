import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { cardKeys, getCard } from '../../../../api/cards';
import {
  getPurchase,
  purchaseKeys,
  updatePurchase,
  type CreatePurchase,
} from '../../../../api/purchases';
import { PurchaseForm } from '../../../../components/PurchaseForm';
import { QueryError } from '../../../../components/QueryError';
import { Screen } from '../../../../components/Screen';
import { invalidateCardLedger } from '../../../../features/ledger-cache';
import { purchaseToFormValues } from '../../../../features/purchase-schema';
import { colors } from '../../../../theme';

/**
 * "Editar compra" (spec 003 US6): the same form with the current values. The rate shown is the one
 * stored in the purchase, never the card's current one (FR-007). Only the increase of the amount
 * is compared with the available credit (FR-012).
 */
export default function EditPurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const purchase = useQuery({ queryKey: purchaseKeys.detail(id), queryFn: () => getPurchase(id) });
  const cardId = purchase.data?.cardId;
  const card = useQuery({
    queryKey: cardKeys.detail(cardId ?? ''),
    queryFn: () => getCard(cardId ?? ''),
    enabled: cardId !== undefined,
  });

  const onSubmit = async (input: Required<CreatePurchase>) => {
    await updatePurchase(id, input);
    if (cardId) await invalidateCardLedger(queryClient, cardId);
    router.back();
  };

  const failed = purchase.isError ? purchase : card.isError ? card : null;
  return (
    <Screen edges={['bottom']}>
      {failed ? (
        <QueryError
          error={failed.error}
          onRetry={() => void failed.refetch()}
          retrying={failed.isFetching}
        />
      ) : purchase.data && card.data ? (
        <PurchaseForm
          defaultValues={purchaseToFormValues(purchase.data)}
          today={card.data.cycle.today}
          annualRate={purchase.data.annualRate}
          availableCredit={card.data.availableCredit}
          previousAmount={purchase.data.amount}
          submitLabel="Guardar cambios"
          onSubmit={onSubmit}
          onCancel={() => router.back()}
        />
      ) : (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando compra" />
      )}
    </Screen>
  );
}
