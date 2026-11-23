import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '../api/cards';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Text } from './Text';

export interface CardPickerProps {
  /** Active cards, in the order of the carousel. */
  cards: Card[];
  selectedId: string;
  onSelect: (card: Card) => void;
}

function cardName(card: Card): string {
  return card.last4 === null ? card.name : `${card.name} ·· ${card.last4}`;
}

/**
 * The card a purchase is registered on (spec 004 FR-012; contracts/screens.md → CardPicker): the
 * selected card and "Cambiar", which opens the active cards as radio options. Every row ≥ 44.
 */
export function CardPicker({ cards, selectedId, onSelect }: CardPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = cards.find((card) => card.id === selectedId) ?? cards[0];
  if (!selected) return null;
  const canChange = cards.length > 1;

  const summary = (
    <View style={styles.summary}>
      <View style={styles.text}>
        <Text variant="secondary" color="textSecondary">
          Tarjeta
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {cardName(selected)}
        </Text>
      </View>
      {canChange ? (
        <Text variant="bodyStrong" color="primaryStrong">
          {open ? 'Listo' : 'Cambiar'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.panel}>
      {canChange ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tarjeta: ${cardName(selected)}`}
          accessibilityHint={open ? 'Oculta las tarjetas' : 'Muestra tus tarjetas para cambiarla'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {summary}
        </Pressable>
      ) : (
        <View style={styles.row} accessible accessibilityLabel={`Tarjeta: ${cardName(selected)}`}>
          {summary}
        </View>
      )}

      {open ? (
        <View accessibilityRole="radiogroup">
          {cards.map((card) => {
            const checked = card.id === selected.id;
            return (
              <Pressable
                key={card.id}
                accessibilityRole="radio"
                accessibilityLabel={cardName(card)}
                accessibilityState={{ checked }}
                onPress={() => {
                  onSelect(card);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={[styles.radio, checked && styles.radioChecked]}>
                  {checked ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.text} numberOfLines={1}>
                  {cardName(card)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const RADIO = spacing.xl;
const DOT = spacing.sm;

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
    justifyContent: 'center',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
  option: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.primary },
  radioDot: { width: DOT, height: DOT, borderRadius: radius.full, backgroundColor: colors.primary },
  pressed: { opacity: interaction.pressedOpacity },
});
