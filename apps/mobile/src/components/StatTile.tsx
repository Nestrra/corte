import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

/**
 * StatTile of docs/design-system.md: label, amount and an optional secondary line ("Total del
 * mes", "Pagado"). Large amounts shrink to fit one line instead of being cut; read as one sentence.
 */
export function StatTile({
  label,
  amount,
  secondary,
}: {
  label: string;
  /** Already formatted (formatCop). */
  amount: string;
  secondary?: string;
}) {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={[label, amount, secondary].filter(Boolean).join(', ')}
    >
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
      <Text variant="amount" numberOfLines={1} adjustsFontSizeToFit style={styles.tabular}>
        {amount}
      </Text>
      {secondary ? (
        <Text variant="caption" color="textSecondary">
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
