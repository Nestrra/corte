import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { MonthView } from '../api/recurring';
import { formatCop } from '../features/money';
import { colors, radius, spacing } from '../theme';
import { ListPanel } from './ListPanel';
import { RecurringRow } from './RecurringRow';
import { StatTile } from './StatTile';
import { Text } from './Text';

/**
 * The payments of one month (spec 005 FR-012 – FR-015; contracts/screens.md → MonthOverview):
 * "Total del mes" and "Pagado", what is left, and the list in the order of the API (overdue,
 * pending, paid). Used by the home and by the Pagos tab, so both always agree.
 */
export function MonthOverview({ view }: { view: MonthView }) {
  const { totals, items } = view;
  const left =
    items.length === 0
      ? null
      : totals.remaining === 0
        ? 'Todo pagado'
        : `Faltan ${formatCop(totals.remaining)}`;

  return (
    <View style={styles.container}>
      <View style={styles.tiles}>
        <StatTile label="Total del mes" amount={formatCop(totals.total)} />
        <StatTile label="Pagado" amount={formatCop(totals.paid)} />
      </View>
      {left ? (
        <View
          style={[styles.left, totals.remaining === 0 && styles.done]}
          accessibilityLiveRegion="polite"
        >
          <Text
            variant="bodyStrong"
            color={totals.remaining === 0 ? 'success' : 'text'}
            style={styles.tabular}
          >
            {left}
          </Text>
        </View>
      ) : null}
      {items.length === 0 ? (
        <Text color="textSecondary">Sin pagos este mes</Text>
      ) : (
        <ListPanel>
          {items.map((occurrence) => (
            <RecurringRow
              key={occurrence.id}
              occurrence={occurrence}
              onPress={() =>
                router.push({ pathname: '/occurrence/[id]', params: { id: occurrence.id } })
              }
            />
          ))}
        </ListPanel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md },
  left: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  done: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  tabular: { fontVariant: ['tabular-nums'] },
});
