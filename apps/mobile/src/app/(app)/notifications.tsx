import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNotifications, notificationKeys } from '../../api/notifications';
import { ListPanel } from '../../components/ListPanel';
import { NotificationRow } from '../../components/NotificationRow';
import { QueryError } from '../../components/QueryError';
import { Text } from '../../components/Text';
import { useRefetchOnFocus } from '../../features/use-refetch-on-focus';
import { openTarget } from '../../notifications/navigation';
import { useSessionStore } from '../../session/session-store';
import { colors, layout, radius, spacing } from '../../theme';

/**
 * "Notificaciones" (spec 006 US7; contracts/screens.md): the last 30 days, newest first. Opened
 * with `?unavailable=1` when a notification's screen no longer exists (research.md R10).
 */
export default function NotificationsScreen() {
  const { unavailable } = useLocalSearchParams<{ unavailable?: string }>();
  const timeZone = useSessionStore((state) => state.user?.timezone ?? 'America/Bogota');
  const history = useQuery({ queryKey: notificationKeys.history(), queryFn: getNotifications });
  useRefetchOnFocus(history.refetch);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching}
            onRefresh={() => void history.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {unavailable === '1' ? (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <Text variant="bodyStrong" color="warning">
              Esto ya no está disponible
            </Text>
          </View>
        ) : null}

        {history.isPending ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando notificaciones" />
        ) : history.isError ? (
          <QueryError
            error={history.error}
            onRetry={() => void history.refetch()}
            retrying={history.isFetching}
          />
        ) : history.data.length === 0 ? (
          <Text color="textSecondary">Sin notificaciones en los últimos 30 días</Text>
        ) : (
          <ListPanel>
            {history.data.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                timeZone={timeZone}
                onPress={() => void openTarget(notification.target)}
              />
            ))}
          </ListPanel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: layout.sectionGap,
    gap: spacing.lg,
  },
  banner: { backgroundColor: colors.warningSoft, borderRadius: radius.panel, padding: spacing.lg },
});
