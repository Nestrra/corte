import { budgetLevel, type BudgetLevel } from '@corte/domain';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, type ColorToken } from '../theme';

const FILL: Record<BudgetLevel, ColorToken> = {
  normal: 'primary',
  warning: 'warning',
  danger: 'danger',
};

/** Height of the bar: 8 (docs/design-system.md → ProgressBar). */
const HEIGHT = spacing.sm;

export interface ProgressBarProps {
  /** Whole percent; may exceed 100 (the bar stays full). */
  percent: number;
  /** Full sentence read by screen readers, e.g. "Tope del ciclo: 105 por ciento, superado". */
  accessibilityLabel: string;
}

/**
 * Cycle budget bar of docs/design-system.md: `primarySoft` track; `primary` fill, `warning` from
 * 70% and `danger` from 100% (`budgetLevel` of @corte/domain). The percent is always written next
 * to it by the caller, so the level does not depend on color alone.
 */
export function ProgressBar({ percent, accessibilityLabel }: ProgressBarProps) {
  const shown = Math.min(Math.max(percent, 0), 100);
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: shown }}
    >
      <View
        style={[
          styles.fill,
          { width: `${shown}%`, backgroundColor: colors[FILL[budgetLevel(percent)]] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  fill: { height: HEIGHT, borderRadius: radius.full },
});
