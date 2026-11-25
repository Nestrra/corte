import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Notification, NotificationKind } from '../api/notifications';
import { notificationMomentLabel } from '../features/dates';
import { colors, interaction, layout, spacing, type ColorToken } from '../theme';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = spacing['2xl'];

/** Icon by kind (contracts/screens.md → NotificationRow); the budget alert in `warning`. */
const ICONS: Record<NotificationKind, { name: IconName; color: ColorToken }> = {
  budget_alert: { name: 'alert-circle-outline', color: 'warning' },
  cutoff_reminder: { name: 'cut-outline', color: 'primaryStrong' },
  payment_reminder: { name: 'card-outline', color: 'primaryStrong' },
  recurring_reminder: { name: 'calendar-outline', color: 'primaryStrong' },
};

/** Lower-cases the first letter so the body reads on after the title. */
function continued(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

export interface NotificationRowProps {
  notification: Notification;
  /** The user's time zone, for "Hoy, 7:00". */
  timeZone: string;
  onPress: () => void;
}

/**
 * NotificationRow (specs/006-alerts-reminders/contracts/screens.md): icon, title (`bodyStrong`),
 * text up to 3 lines (`secondary`, `textSecondary`) and when it arrived (`caption`,
 * `textTertiary`). At least 44 high; read as one sentence.
 */
export function NotificationRow({ notification, timeZone, onPress }: NotificationRowProps) {
  const icon = ICONS[notification.kind];
  const moment = notificationMomentLabel(notification.createdAt, timeZone);
  const label = `${notification.title}, ${continued(notification.body).replace(/\.$/, '')}, ${moment.spoken}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon.name} size={ICON_SIZE} color={colors[icon.color]} />
      <View style={styles.texts}>
        <View style={styles.header}>
          <Text variant="bodyStrong" style={styles.title} numberOfLines={2}>
            {notification.title}
          </Text>
          <Text variant="caption" color="textTertiary" style={styles.tabular}>
            {moment.text}
          </Text>
        </View>
        <Text variant="secondary" color="textSecondary" numberOfLines={3} style={styles.tabular}>
          {notification.body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  texts: { flex: 1, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: interaction.pressedOpacity },
});
