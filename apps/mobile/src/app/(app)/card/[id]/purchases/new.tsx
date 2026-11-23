import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';
import { cardKeys, getCard } from '../../../../../api/cards';
import { createPurchase, type CreatePurchase } from '../../../../../api/purchases';
import { CARD_ARCHIVED_PURCHASES_TEXT } from '../../../../../api/errors';
import { Button } from '../../../../../components/Button';
import { PurchaseForm } from '../../../../../components/PurchaseForm';
import { QueryError } from '../../../../../components/QueryError';
import { Screen } from '../../../../../components/Screen';
import { Text } from '../../../../../components/Text';
import { formatLongDate } from '../../../../../features/dates';
import { invalidateCardLedger } from '../../../../../features/ledger-cache';
import { emptyPurchaseForm } from '../../../../../features/purchase-schema';
import { colors } from '../../../../../theme';

/**
 * "Registrar compra" (spec 003 US2): today and 1 installment by default; on save, tells in which
 * statement the first installment falls and when it is paid (FR-010).
 */
export default function NewPurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: cardKeys.detail(id), queryFn: () => getCard(id) });

  const onSubmit = async (input: Required<CreatePurchase>) => {
    const purchase = await createPurchase(id, input);
    await invalidateCardLedger(queryClient, id);
    const first = purchase.installments[0];
    const message = first
      ? `Primera cuota en el extracto del ${formatLongDate(first.cutoffDate)} · se paga el ${formatLongDate(first.dueDate)}.`
      : 'La compra quedó guardada.';
    Alert.alert('Compra registrada', message, [
      {
        text: 'Ver compra',
        onPress: () => router.replace({ pathname: '/purchase/[id]', params: { id: purchase.id } }),
      },
      { text: 'Listo', style: 'cancel', onPress: () => router.back() },
    ]);
  };

  if (detail.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjeta" />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </Screen>
    );
  }

  const card = detail.data;
  if (card.archivedAt !== null) {
    return (
      <Screen edges={['bottom']}>
        <Text>{CARD_ARCHIVED_PURCHASES_TEXT}</Text>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="secondary" color="textSecondary">
        {card.name}
      </Text>
      <PurchaseForm
        defaultValues={emptyPurchaseForm(card.cycle.today)}
        today={card.cycle.today}
        annualRate={card.annualRate}
        availableCredit={card.availableCredit}
        submitLabel="Guardar compra"
        onSubmit={onSubmit}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
