import Ionicons from '@expo/vector-icons/Ionicons';
import { CARD_COLORS, type CardColor } from '@corte/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { cardColors, colors, interaction, layout, radius, spacing } from '../theme';
import { CardGradient } from './CardGradient';
import { Text } from './Text';

/** Accessible Spanish name of each card color (contracts/screens.md → ColorPicker). */
export const CARD_COLOR_NAMES: Record<CardColor, string> = {
  negro: 'Negro',
  morado: 'Morado',
  amarillo: 'Amarillo',
  naranja: 'Naranja',
  verde: 'Verde',
  marron: 'Marrón',
};

const SELECTED_BORDER = 3;

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: CardColor) => void;
  error?: string;
}

/**
 * Radio group of the 6 card colors: 44 × 44 circles with the card gradient; the chosen one has a
 * `text` border and a check icon in the card's text color (dark on amarillo), so the choice is
 * not shown by color alone. Screen readers hear the name and whether it is selected.
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
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <CardGradient color={color} style={[styles.swatch, checked && styles.checked]}>
                {checked ? (
                  <Ionicons name="checkmark" size={22} color={cardColors[color].text} />
                ) : null}
              </CardGradient>
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
  option: { width: layout.minTouchTarget, height: layout.minTouchTarget },
  swatch: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { borderWidth: SELECTED_BORDER, borderColor: colors.text },
  pressed: { opacity: interaction.pressedOpacity },
});
