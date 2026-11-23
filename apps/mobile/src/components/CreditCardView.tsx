import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '../api/cards';
import { formatCop } from '../features/money';
import { cardColors, interaction, layout, radius, spacing } from '../theme';
import { CardGradient } from './CardGradient';
import { Text } from './Text';

type CardSummary = Pick<
  Card,
  'name' | 'color' | 'last4' | 'availableCredit' | 'cutoffDay' | 'dueDay'
>;

export interface CreditCardViewProps {
  card: CardSummary;
  /** Width in points; the height follows the card proportion (`layout.cardAspectRatio`). */
  width: number;
  /** Makes the card a button (carousel). */
  onPress?: () => void;
}

/** Height of a card of the given width (1,586:1). */
export function creditCardHeight(width: number): number {
  return Math.round(width / layout.cardAspectRatio);
}

/** "Corte día 8 · Pago día 25" */
export function cycleDaysText(card: Pick<Card, 'cutoffDay' | 'dueDay'>): string {
  return `Corte día ${card.cutoffDay} · Pago día ${card.dueDay}`;
}

/** Everything the card shows, read as one sentence by screen readers. */
export function creditCardLabel(card: CardSummary): string {
  const last4 = card.last4 ? `, terminada en ${card.last4}` : '';
  const over = card.availableCredit < 0 ? ' Superaste el cupo.' : '';
  return `${card.name}${last4}. Cupo disponible ${formatCop(card.availableCredit)}.${over} ${cycleDaysText(card)}`;
}

/**
 * Credit card from docs/design-system.md (contracts/screens.md → CreditCardView): proportion
 * 1,586:1, radius `card`, diagonal gradient of its color and the text colors of that color
 * (dark text on amarillo). Without last 4 digits the "****" line is not shown (spec US2).
 */
export function CreditCardView({ card, width, onPress }: CreditCardViewProps) {
  const palette = cardColors[card.color];
  const text = { color: palette.text };
  const secondary = { color: palette.textSecondary };
  const size = { width, height: creditCardHeight(width) };

  const face = (
    <CardGradient color={card.color} style={[styles.card, size]}>
      <View style={styles.top}>
        <Text variant="bodyStrong" style={text} numberOfLines={1}>
          {card.name}
        </Text>
        {card.last4 ? (
          <Text variant="secondary" style={secondary}>
            **** {card.last4}
          </Text>
        ) : null}
      </View>
      <View>
        {/* Below zero the label itself says so: the state is never conveyed by the sign alone. */}
        <Text variant="caption" style={secondary}>
          {card.availableCredit < 0 ? 'Superaste el cupo' : 'Cupo disponible'}
        </Text>
        <Text variant="amount" style={text} numberOfLines={1} adjustsFontSizeToFit>
          {formatCop(card.availableCredit)}
        </Text>

        <Text variant="caption" style={secondary}>
          {cycleDaysText(card)}
        </Text>
      </View>
    </CardGradient>
  );

  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={creditCardLabel(card)} style={size}>
        {face}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={creditCardLabel(card)}
      accessibilityHint="Abre el detalle de la tarjeta"
      onPress={onPress}
      style={({ pressed }) => [size, pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  top: { gap: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
});
