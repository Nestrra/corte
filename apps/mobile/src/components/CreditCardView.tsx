import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '../api/cards';
import { formatCop } from '../features/money';
import { cardColors, interaction, radius, spacing } from '../theme';
import { Text } from './Text';

/** Size from docs/design-system.md; the carousel snaps on this width plus the gap. */
export const CREDIT_CARD_WIDTH = 300;
export const CREDIT_CARD_HEIGHT = 184;

type CardSummary = Pick<
  Card,
  'name' | 'color' | 'last4' | 'availableCredit' | 'cutoffDay' | 'dueDay'
>;

export interface CreditCardViewProps {
  card: CardSummary;
  /** Makes the card a button (carousel). */
  onPress?: () => void;
}

/** "Corte día 8 · Pago día 25" */
export function cycleDaysText(card: Pick<Card, 'cutoffDay' | 'dueDay'>): string {
  return `Corte día ${card.cutoffDay} · Pago día ${card.dueDay}`;
}

/** Everything the card shows, read as one sentence by screen readers. */
export function creditCardLabel(card: CardSummary): string {
  const last4 = card.last4 ? `, terminada en ${card.last4}` : '';
  return `${card.name}${last4}. Cupo disponible ${formatCop(card.availableCredit)}. ${cycleDaysText(card)}`;
}

/**
 * Credit card from docs/design-system.md (contracts/screens.md → CreditCardView): 300 × 184,
 * radius `card`, background `cardColors[color]`, white text. Without last 4 digits the "****"
 * line is not shown (spec US2 scenario 2).
 */
export function CreditCardView({ card, onPress }: CreditCardViewProps) {
  const content = (
    <>
      <View style={styles.top}>
        <Text variant="bodyStrong" color="onPrimary" numberOfLines={1}>
          {card.name}
        </Text>
        {card.last4 ? (
          <Text variant="secondary" color="onCardSecondary">
            **** {card.last4}
          </Text>
        ) : null}
      </View>
      <View>
        <Text variant="caption" color="onCardSecondary">
          Cupo disponible
        </Text>
        <Text variant="amount" color="onPrimary" numberOfLines={1} adjustsFontSizeToFit>
          {formatCop(card.availableCredit)}
        </Text>
        <Text variant="caption" color="onCardSecondary">
          {cycleDaysText(card)}
        </Text>
      </View>
    </>
  );
  const background = { backgroundColor: cardColors[card.color] };

  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={creditCardLabel(card)} style={[styles.card, background]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={creditCardLabel(card)}
      accessibilityHint="Abre el detalle de la tarjeta"
      onPress={onPress}
      style={({ pressed }) => [styles.card, background, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CREDIT_CARD_WIDTH,
    height: CREDIT_CARD_HEIGHT,
    borderRadius: radius.card,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  top: { gap: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
});
