import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { cardKeys, createCard, type CardInput } from '../../../api/cards';
import { CardForm } from '../../../components/CardForm';
import { Screen } from '../../../components/Screen';
import { EMPTY_CARD_FORM } from '../../../features/card-schema';

/** "Nueva tarjeta" (spec US2): creates the card and goes back to the Tarjetas tab. */
export default function NewCardScreen() {
  const queryClient = useQueryClient();

  const onSubmit = async (input: CardInput) => {
    await createCard(input);
    await queryClient.invalidateQueries({ queryKey: cardKeys.all });
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
