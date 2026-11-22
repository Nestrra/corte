import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { Card } from '../api/cards';
import { colors, layout, radius, spacing } from '../theme';
import { CREDIT_CARD_WIDTH, CreditCardView } from './CreditCardView';

const GAP = spacing.md;
/** One card plus the gap: the carousel moves one card at a time (research.md R9). */
const SNAP_INTERVAL = CREDIT_CARD_WIDTH + GAP;
const DOT_SIZE = spacing.sm;

export interface CardCarouselProps {
  cards: Card[];
  onPressCard: (card: Card) => void;
}

/**
 * Horizontal carousel of cards (contracts/screens.md → CardCarousel). The screen margin leaves
 * the edge of the next card visible; the dots below tell the position by size as well as color.
 */
export function CardCarousel({ cards, onPressCard }: CardCarouselProps) {
  const [position, setActive] = useState(0);
  // The list can shrink (a card archived elsewhere) while the index is kept.
  const active = Math.min(position, Math.max(cards.length - 1, 0));

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActive(Math.min(Math.max(index, 0), cards.length - 1));
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(card) => card.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => <CreditCardView card={item} onPress={() => onPressCard(item)} />}
      />
      {cards.length > 1 ? (
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Tarjeta ${active + 1} de ${cards.length}`}
        >
          {cards.map((card, index) => (
            <View key={card.id} style={[styles.dot, index === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The list spans the full width; the margin goes inside so cards scroll to the screen edges.
  container: { marginHorizontal: -layout.screenMargin, gap: spacing.md },
  content: { paddingHorizontal: layout.screenMargin },
  separator: { width: GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: { width: spacing.xl, backgroundColor: colors.primary },
});
