import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listRecurring, recurringKeys, type RecurringPayment } from '../../../api/recurring';
import { ListPanel } from '../../../components/ListPanel';
import { QueryError } from '../../../components/QueryError';
import { Screen } from '../../../components/Screen';
import { SectionHeader } from '../../../components/SectionHeader';
import { Text } from '../../../components/Text';
import { formatCop } from '../../../features/money';
import { frequencyText } from '../../../features/months';
import { useRefetchOnAppActive } from '../../../features/use-refetch-on-app-active';
import { useRefetchOnFocus } from '../../../features/use-refetch-on-focus';
import { colors, interaction, layout, spacing } from '../../../theme';

const STATUS_TEXT: Record<RecurringPayment['status'], string> = {
  active: 'Activo',
  paused: 'Pausado',
};

function PaymentRow({ payment }: { payment: RecurringPayment }) {
  const frequency = frequencyText(payment);
  const amount = formatCop(payment.amount);
  const status = STATUS_TEXT[payment.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${payment.name}, ${frequency}, ${amount}, ${status.toLowerCase()}`}
      accessibilityHint="Abre el pago"
      onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: payment.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {payment.name}
        </Text>
        <Text variant="secondary" color="textSecondary">
          {frequency}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit style={styles.tabular}>
          {amount}
        </Text>
        <Text variant="caption" color={payment.status === 'active' ? 'textSecondary' : 'warning'}>
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

/** "Mis pagos" (spec 005 US4; FR-019; contracts/screens.md): active first, then paused. */
export default function RecurringListScreen() {
  const list = useQuery({ queryKey: recurringKeys.list(), queryFn: listRecurring });
  useRefetchOnFocus(list.refetch);
  useRefetchOnAppActive(list.refetch);

  return (
    <Screen edges={['bottom']}>
      <SectionHeader
        title="Mis pagos"
        action="Nuevo"
        actionLabel="Nuevo pago recurrente"
        onAction={() => router.push('/recurring/new')}
      />
      {list.isPending ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando pagos" />
      ) : list.isError ? (
        <QueryError
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : list.data.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong">Agrega tus pagos fijos</Text>
          <Text color="textSecondary">
            Arriendo, servicios, suscripciones: te mostramos cuánto falta cada mes.
          </Text>
        </View>
      ) : (
        <ListPanel>
          {list.data.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} />
          ))}
        </ListPanel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  left: { flex: 1, gap: spacing.xs },
  right: { flexShrink: 1, alignItems: 'flex-end', gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  empty: { gap: spacing.xs },
  pressed: { opacity: interaction.pressedOpacity },
});
