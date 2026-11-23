import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { cardKeys, getCard } from '../../../../../api/cards';
import { listPurchases, purchaseKeys, type Purchase } from '../../../../../api/purchases';
import { Button } from '../../../../../components/Button';
import { ListPanel } from '../../../../../components/ListPanel';
import { QueryError } from '../../../../../components/QueryError';
import { Screen } from '../../../../../components/Screen';
import { Text } from '../../../../../components/Text';
import { formatLongDate, formatShortDate } from '../../../../../features/dates';
import { formatCop } from '../../../../../features/money';
import { useRefetchOnFocus } from '../../../../../features/use-refetch-on-focus';
import { colors, interaction, layout, spacing } from '../../../../../theme';

function installmentsText(count: number): string {
  return count === 1 ? '1 cuota' : `${count} cuotas`;
}

function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const label = `${purchase.concept}, ${formatLongDate(purchase.purchaseDate)}, ${formatCop(purchase.amount)}, ${installmentsText(purchase.installmentCount)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el detalle de la compra"
      onPress={() => router.push({ pathname: '/purchase/[id]', params: { id: purchase.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text numberOfLines={1}>{purchase.concept}</Text>
        <Text variant="secondary" color="textSecondary">
          {formatShortDate(purchase.purchaseDate)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyStrong" style={styles.tabular}>
          {formatCop(purchase.amount)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {installmentsText(purchase.installmentCount)}
        </Text>
      </View>
    </Pressable>
  );
}

/** Purchases of a card (spec 003 US6, FR-013), newest purchase date first. */
export default function PurchasesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useQuery({ queryKey: cardKeys.detail(id), queryFn: () => getCard(id) });
  const purchases = useQuery({ queryKey: purchaseKeys.list(id), queryFn: () => listPurchases(id) });
  useRefetchOnFocus(purchases.refetch);

  const isActive = card.data?.archivedAt === null;
  const registerButton = isActive ? (
    <Button
      label="Registrar compra"
      onPress={() => router.push({ pathname: '/card/[id]/purchases/new', params: { id } })}
    />
  ) : null;

  if (purchases.isPending) {
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando compras" />
      </Screen>
    );
  }
  if (purchases.isError) {
    return (
      <Screen edges={['bottom']}>
        <QueryError
          error={purchases.error}
          onRetry={() => void purchases.refetch()}
          retrying={purchases.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {purchases.data.length === 0 ? (
        <Text variant="section" accessibilityRole="header">
          Aún no hay compras
        </Text>
      ) : (
        <ListPanel>
          {purchases.data.map((purchase) => (
            <PurchaseRow key={purchase.id} purchase={purchase} />
          ))}
        </ListPanel>
      )}
      {registerButton}
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
  right: { alignItems: 'flex-end', gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: interaction.pressedOpacity },
});
