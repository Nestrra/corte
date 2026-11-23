import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { Card } from '../api/cards';
import { colors, layout, radius, spacing } from '../theme';
import { CreditCardView } from './CreditCardView';

const MARGIN = layout.screenMargin;
/** Gap between cards; with the width below, `layout.cardPeek` (16) of the next card shows. */
const GAP = layout.screenMargin;
const DOT_SIZE = spacing.sm;

/**
 * Card width in the carousel (docs/design-system.md → CardCarousel): one card fills the screen
 * minus the margins (W − 40); with several, W − 56 so the edge of the next one shows.
 */
export function carouselCardWidth(screenWidth: number, count: number): number {
  return count > 1 ? screenWidth - 2 * MARGIN - layout.cardPeek : screenWidth - 2 * MARGIN;
}

/**
 * Scroll offsets where each card starts at the left margin. The last offset is clamped to the
 * end of the content, so the last card rests at the right margin instead of overscrolling.
 */
export function carouselSnapOffsets(screenWidth: number, count: number): number[] {
  const cardWidth = carouselCardWidth(screenWidth, count);
  const contentWidth = 2 * MARGIN + count * cardWidth + (count - 1) * GAP;
  const maxOffset = Math.max(contentWidth - screenWidth, 0);
  return Array.from({ length: count }, (_, index) =>
    Math.min(index * (cardWidth + GAP), maxOffset),
  );
}

export interface CardCarouselProps {
  cards: Card[];
  onPressCard: (card: Card) => void;
  /**
   * The card in front: called on mount, after each swipe and when the list changes (spec 004
   * contracts/screens.md → CardCarousel). Only the home uses it.
   */
  onActiveChange?: (card: Card) => void;
}

/**
 * Carousel of active cards (contracts/screens.md → CardCarousel). A single card is centered;
 * several scroll one at a time with dots that tell the position by size as well as color.
 */
export function CardCarousel({ cards, onPressCard, onActiveChange }: CardCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [position, setPosition] = useState(0);
  const cardWidth = carouselCardWidth(screenWidth, cards.length);
  const offsets = useMemo(
    () => carouselSnapOffsets(screenWidth, cards.length),
    [screenWidth, cards.length],
  );
  // The list can shrink (a card archived elsewhere) while the index is kept.
  const active = Math.min(position, Math.max(cards.length - 1, 0));
  const activeCard = cards[active];

  // The latest callback and card, kept in refs so the effect below only runs when the card in
  // front changes (mount, swipe, or a list where another card ends up in front).
  const latest = useRef({ onActiveChange, activeCard });
  useEffect(() => {
    latest.current = { onActiveChange, activeCard };
  });
  const activeId = activeCard?.id;
  useEffect(() => {
    const { onActiveChange: notify, activeCard: card } = latest.current;
    if (card && card.id === activeId) notify?.(card);
  }, [activeId]);

  const firstCard = cards[0];
  if (cards.length === 1 && firstCard !== undefined) {
    return (
      <View style={styles.single}>
        <CreditCardView card={firstCard} width={cardWidth} onPress={() => onPressCard(firstCard)} />
      </View>
    );
  }

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    let nearest = 0;
    offsets.forEach((offset, index) => {
      if (Math.abs(offset - x) < Math.abs((offsets[nearest] ?? 0) - x)) nearest = index;
    });
    setPosition(nearest);
  };

  return (
    <View style={styles.multiple}>
      {/* Breaks out of the screen padding so cards scroll to the screen edges. */}
      <FlatList
        style={{ width: screenWidth }}
        data={cards}
        keyExtractor={(card) => card.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={offsets}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.content}
        getItemLayout={(_, index) => ({
          length: cardWidth + GAP,
          offset: MARGIN + index * (cardWidth + GAP),
          index,
        })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <View style={index < cards.length - 1 ? styles.gap : undefined}>
            <CreditCardView card={item} width={cardWidth} onPress={() => onPressCard(item)} />
          </View>
        )}
      />
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Tarjeta ${active + 1} de ${cards.length}`}
      >
        {cards.map((card, index) => (
          <View key={card.id} style={[styles.dot, index === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: { alignItems: 'center' },
  multiple: { marginHorizontal: -MARGIN, gap: spacing.md },
  content: { paddingHorizontal: MARGIN },
  gap: { marginRight: GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: { width: spacing.xl, backgroundColor: colors.primary },
});
