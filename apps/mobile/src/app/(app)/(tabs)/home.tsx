import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getSummary, summaryKeys } from '../../../api/summary';
import { CardCarousel } from '../../../components/CardCarousel';
import { CycleSummary } from '../../../components/CycleSummary';
import { EmptyCards } from '../../../components/EmptyCards';
import { QueryError } from '../../../components/QueryError';
import { RecurringSection } from '../../../components/RecurringSection';
import { Screen } from '../../../components/Screen';
import { SectionHeader } from '../../../components/SectionHeader';
import { Text } from '../../../components/Text';
import { useFrontCardStore } from '../../../features/front-card-store';
import { useRefetchOnAppActive } from '../../../features/use-refetch-on-app-active';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { useSessionStore } from '../../../session/session-store';
import { colors, spacing } from '../../../theme';

/**
 * Inicio (spec 004 US2, US4, US5; spec 005 US2; docs/design-system.md → Pantalla de inicio):
 * greeting, "Mis tarjetas" with the carousel, the summary of the card in front, and "Pagos de
 * <mes>". The summary is fetched again on focus and when the app comes back to the foreground, so
 * days and statuses follow the new "today".
 */
export default function HomeScreen() {
  const name = useSessionStore((state) => state.user?.name ?? '');
  const frontCardId = useFrontCardStore((state) => state.frontCardId);
  const setFrontCardId = useFrontCardStore((state) => state.setFrontCardId);
  const summary = useQuery({ queryKey: summaryKeys.all, queryFn: getSummary });
  useRefetchOnFocus(summary.refetch);
  useRefetchOnAppActive(summary.refetch);

  const cards = summary.data?.cards ?? [];
  // The stored card may have been archived meanwhile: then the first one is in front.
  const front = cards.find((item) => item.card.id === frontCardId) ?? cards[0];

  return (
    <Screen edges={['top']}>
      <Text variant="title" accessibilityRole="header">
        Hola, {name}
      </Text>

      {summary.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando inicio" />
      ) : summary.isError ? (
        <QueryError
          error={summary.error}
          onRetry={() => void summary.refetch()}
          retrying={summary.isFetching}
        />
      ) : (
        <>
          {cards.length === 0 ? (
            <EmptyCards />
          ) : (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="Mis tarjetas"
                  action="Agregar"
                  actionLabel="Agregar tarjeta"
                  onAction={() => router.push('/card/new')}
                />
                <CardCarousel
                  cards={cards.map((item) => item.card)}
                  onPressCard={(card) =>
                    router.push({ pathname: '/card/[id]', params: { id: card.id } })
                  }
                  onActiveChange={(card) => setFrontCardId(card.id)}
                />
              </View>
              {front ? <CycleSummary summary={front} /> : null}
            </>
          )}
          <RecurringSection view={summary.data.recurring} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
