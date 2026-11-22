import Ionicons from '@expo/vector-icons/Ionicons';
import { CARD_COLORS, type CardColor } from '@corte/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { cardColors, colors, interaction, layout, radius, spacing } from '../theme';
import { Text } from './Text';

/** Accessible Spanish name of each card color (contracts/screens.md → ColorPicker). */
export const CARD_COLOR_NAMES: Record<CardColor, string> = {
  indigo: 'Índigo',
  petroleo: 'Petróleo',
  ciruela: 'Ciruela',
  grafito: 'Grafito',
  bosque: 'Bosque',
  terracota: 'Terracota',
};

const SELECTED_BORDER = 3;

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: CardColor) => void;
  error?: string;
}

/**
 * Radio group of the 6 card colors: 44 × 44 circles; the chosen one has a `text` border and a
 * check icon, so the choice is not shown by color alone. Screen readers hear the name and state.
 */
export function ColorPicker({ label, value, onChange, error }: ColorPickerProps) {
  return (
    <View style={styles.container}>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.options}>
        {CARD_COLORS.map((color) => {
          const checked = value === color;
          return (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={CARD_COLOR_NAMES[color]}
              accessibilityState={{ checked }}
              onPress={() => onChange(color)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: cardColors[color] },
                checked && styles.checked,
                pressed && styles.pressed,
              ]}
            >
              {checked ? <Ionicons name="checkmark" size={22} color={colors.onPrimary} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  option: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { borderWidth: SELECTED_BORDER, borderColor: colors.text },
  pressed: { opacity: interaction.pressedOpacity },
});
