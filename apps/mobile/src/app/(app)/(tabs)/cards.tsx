import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { cardKeys, listCards } from '../../../api/cards';
import { Button } from '../../../components/Button';
import { CardCarousel } from '../../../components/CardCarousel';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { colors, spacing } from '../../../theme';

/** Tarjetas tab (spec US3, US6): carousel of active cards, empty state and archived cards. */
export default function CardsScreen() {
  const active = useQuery({ queryKey: cardKeys.list(false), queryFn: () => listCards(false) });
  const archived = useQuery({ queryKey: cardKeys.list(true), queryFn: () => listCards(true) });
  useRefetchOnFocus(active.refetch);
  useRefetchOnFocus(archived.refetch);

  const archivedCount = archived.data?.length ?? 0;

  return (
    <Screen edges={['top']}>
      <Text variant="title" accessibilityRole="header">
        Tarjetas
      </Text>

      {active.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjetas" />
      ) : active.isError ? (
        <QueryError
          error={active.error}
          onRetry={() => void active.refetch()}
          retrying={active.isFetching}
        />
      ) : active.data.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="section">Aún no tienes tarjetas</Text>
          <Text color="textSecondary">
            Agrega tu primera tarjeta con su día de corte y su día límite de pago para saber cuándo
            cierra cada ciclo.
          </Text>
        </View>
      ) : (
        <CardCarousel
          cards={active.data}
          onPressCard={(card) => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
        />
      )}

      <View style={styles.actions}>
        <Button label="Agregar tarjeta" onPress={() => router.push('/card/new')} />
        {archivedCount > 0 ? (
          <Button
            label={`Archivadas (${archivedCount})`}
            variant="secondary"
            onPress={() => router.push('/card/archived')}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
