import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { cardKeys, listCards, type Card } from '../../../api/cards';
import { CARD_COLOR_NAMES } from '../../../components/ColorPicker';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { cardColors, colors, interaction, layout, radius, spacing } from '../../../theme';

const SWATCH_SIZE = spacing.lg;

function ArchivedRow({ card }: { card: Card }) {
  const last4 = card.last4 ? `**** ${card.last4}` : null;
  const label = [
    card.name,
    last4 ? `terminada en ${card.last4}` : null,
    CARD_COLOR_NAMES[card.color],
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre la tarjeta archivada"
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.swatch, { backgroundColor: cardColors[card.color] }]} />
      <View style={styles.rowText}>
        <Text numberOfLines={1}>{card.name}</Text>
        {last4 ? (
          <Text variant="secondary" color="textSecondary">
            {last4}
          </Text>
        ) : null}
      </View>
      <Text color="textTertiary">›</Text>
    </Pressable>
  );
}

/** Archived cards (spec US6); each opens its read-only detail with "Restaurar". */
export default function ArchivedCardsScreen() {
  const archived = useQuery({ queryKey: cardKeys.list(true), queryFn: () => listCards(true) });
  useRefetchOnFocus(archived.refetch);

  return (
    <Screen edges={['bottom']}>
      {archived.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tarjetas" />
      ) : archived.isError ? (
        <QueryError
          error={archived.error}
          onRetry={() => void archived.refetch()}
          retrying={archived.isFetching}
        />
      ) : archived.data.length === 0 ? (
        <Text color="textSecondary">No tienes tarjetas archivadas</Text>
      ) : (
        <View style={styles.panel}>
          {archived.data.map((card, index) => (
            <View key={card.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ArchivedRow card={card} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: radius.full },
  rowText: { flex: 1, gap: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg },
});
