import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createCard, type CardInput } from '../../../api/cards';
import { CardForm } from '../../../components/CardForm';
import { Screen } from '../../../components/Screen';
import { EMPTY_CARD_FORM } from '../../../features/card-schema';
import { invalidateCards } from '../../../features/ledger-cache';

/** "Nueva tarjeta" (spec 002 US2): creates the card and goes back (Tarjetas tab or home). */
export default function NewCardScreen() {
  const queryClient = useQueryClient();

  const onSubmit = async (input: CardInput) => {
    await createCard(input);
    await invalidateCards(queryClient);
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <CardForm
        defaultValues={EMPTY_CARD_FORM}
        onSubmit={onSubmit}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
