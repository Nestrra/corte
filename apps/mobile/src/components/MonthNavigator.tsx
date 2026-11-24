import Ionicons from '@expo/vector-icons/Ionicons';
import type { MonthKey } from '@corte/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { monthLabel, shiftMonth } from '../features/months';
import { colors, interaction, layout, radius, spacing } from '../theme';
import { Text } from './Text';

const ICON_SIZE = spacing.xl;

function Arrow({
  direction,
  disabled,
  onPress,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onPress: () => void;
}) {
  const label = direction === 'back' ? 'Mes anterior' : 'Mes siguiente';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Ionicons
        name={direction === 'back' ? 'chevron-back' : 'chevron-forward'}
        size={ICON_SIZE}
        color={disabled ? colors.textTertiary : colors.primaryStrong}
      />
    </Pressable>
  );
}

/**
 * MonthNavigator of specs/005-recurring-payments/contracts/screens.md: previous and next month
 * (44 × 44, disabled outside `bounds`) and the month as a header in a polite live region, so the
 * screen reader says the new month (FR-018).
 */
export function MonthNavigator({
  month,
  bounds,
  onChange,
}: {
  month: MonthKey;
  bounds: { first: MonthKey; last: MonthKey };
  onChange: (month: MonthKey) => void;
}) {
  return (
    <View style={styles.row}>
      <Arrow
        direction="back"
        disabled={month <= bounds.first}
        onPress={() => onChange(shiftMonth(month, -1))}
      />
      <View style={styles.label} accessibilityLiveRegion="polite">
        <Text variant="bodyStrong" accessibilityRole="header" style={styles.center}>
          {monthLabel(month)}
        </Text>
      </View>
      <Arrow
        direction="forward"
        disabled={month >= bounds.last}
        onPress={() => onChange(shiftMonth(month, 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  arrow: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
  },
  label: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: interaction.pressedOpacity },
});
