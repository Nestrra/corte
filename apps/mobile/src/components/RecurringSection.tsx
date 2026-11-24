import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { MonthView } from '../api/recurring';
import { monthName } from '../features/months';
import { colors, radius, spacing } from '../theme';
import { MonthOverview } from './MonthOverview';
import { SectionHeader } from './SectionHeader';
import { Text } from './Text';

/**
 * "Pagos de <mes>" of the home (spec 005 US2; contracts/screens.md → RecurringSection): header with
 * "Nuevo" and the month overview, or an invitation when the user has no payments yet (FR-015).
 */
export function RecurringSection({ view }: { view: MonthView }) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={`Pagos de ${monthName(view.month)}`}
        action="Nuevo"
        actionLabel="Nuevo pago recurrente"
        onAction={() => router.push('/recurring/new')}
      />
      {view.hasPayments ? (
        <MonthOverview view={view} />
      ) : (
        <View style={styles.empty}>
          <Text variant="bodyStrong">Agrega tus pagos fijos</Text>
          <Text color="textSecondary">
            Arriendo, servicios, suscripciones: te mostramos cuánto falta cada mes.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  empty: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
