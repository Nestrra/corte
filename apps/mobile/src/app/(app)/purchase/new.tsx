import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { cardKeys, getCard, listCards } from '../../../api/cards';
import { createPurchase, type CreatePurchase } from '../../../api/purchases';
import { CardPicker } from '../../../components/CardPicker';
import { EmptyCards } from '../../../components/EmptyCards';
import { PurchaseForm } from '../../../components/PurchaseForm';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { formatLongDate } from '../../../features/dates';
import { invalidateCardLedger } from '../../../features/ledger-cache';
import { emptyPurchaseForm } from '../../../features/purchase-schema';
import { colors } from '../../../theme';

/**
 * "Registrar compra" (spec 003 US2, spec 004 US1 and US3): opened from the center button with the
 * card in front of the home, or from a card detail with that card. The card can be changed without
 * losing what was written; the form simulates the purchase while it is filled in. On save, tells in
 * which statement the first installment falls and when it is paid (spec 003 FR-010).
 */
export default function NewPurchaseScreen() {
  const { cardId: requestedId } = useLocalSearchParams<{ cardId?: string }>();
  const queryClient = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(null);

  const cards = useQuery({ queryKey: cardKeys.list(false), queryFn: () => listCards(false) });
  const active = cards.data ?? [];
  // A requested card that is no longer active (archived or deleted) falls back to the first one.
  const selectedId =
    [chosenId, requestedId].find((id) => id && active.some((card) => card.id === id)) ??
    active[0]?.id;

  const detail = useQuery({
    queryKey: cardKeys.detail(selectedId ?? ''),
    queryFn: () => getCard(selectedId ?? ''),
    enabled: selectedId !== undefined,
    // While the new card loads, the form keeps showing (and keeps what was written).
    placeholderData: keepPreviousData,
  });

  if (cards.isPending || (selectedId !== undefined && detail.isPending)) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjetas" />
      </Screen>
    );
  }
  const error = cards.error ?? (detail.data ? null : detail.error);
  if (error) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={error}
          onRetry={() => void (cards.isError ? cards.refetch() : detail.refetch())}
          retrying={cards.isFetching || detail.isFetching}
        />
      </Screen>
    );
  }
  if (selectedId === undefined || !detail.data) {
    return (
      <Screen edges={['bottom']}>
        <EmptyCards replace />
      </Screen>
    );
  }

  // `detail.data` may still be the previous card while the chosen one loads: writes and the
  // simulation always use the chosen card.
  const card = detail.data;
  const cardId = selectedId;
  const onSubmit = async (input: Required<CreatePurchase>) => {
    const purchase = await createPurchase(cardId, input);
    await invalidateCardLedger(queryClient, cardId);
    const first = purchase.installments[0];
    const message = first
      ? `Primera cuota en el extracto del ${formatLongDate(first.cutoffDate)} · se paga el ${formatLongDate(first.dueDate)}.`
      : 'La compra quedó guardada.';
    Alert.alert('Compra registrada', message, [
      {
        text: 'Ver compra',
        onPress: () => router.replace({ pathname: '/purchase/[id]', params: { id: purchase.id } }),
      },
      // Back to the tab or the card detail it was opened from.
      { text: 'Listo', style: 'cancel', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <CardPicker cards={active} selectedId={cardId} onSelect={(next) => setChosenId(next.id)} />
      <PurchaseForm
        defaultValues={emptyPurchaseForm(card.cycle.today)}
        today={card.cycle.today}
        annualRate={card.annualRate}
        availableCredit={card.availableCredit}
        simulateOnCardId={cardId}
        submitLabel="Guardar compra"
        onSubmit={onSubmit}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
