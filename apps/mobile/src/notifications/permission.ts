import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

/** System permission to show notifications (research.md R13). */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** Android channel every push of the API uses (`channelId: 'default'`). */
export const DEFAULT_CHANNEL_ID = 'default';

function toStatus(settings: Notifications.NotificationPermissionsStatus): PermissionStatus {
  if (settings.granted) return 'granted';
  // iOS "provisional" also lets notifications through, quietly.
  if (settings.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return settings.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getNotificationStatus(): Promise<PermissionStatus> {
  return toStatus(await Notifications.getPermissionsAsync());
}

/** Creates (or updates) the Android `default` channel; a no-op on iOS. */
export async function ensureDefaultChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Alertas y recordatorios',
    importance: AndroidImportance.HIGH,
  });
}

/**
 * Asks for the system permission. On Android 13+ the prompt only appears once a channel exists,
 * so the `default` channel (high importance: banner and sound) is created first.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  await ensureDefaultChannel();
  return toStatus(await Notifications.requestPermissionsAsync());
}

/** Opens this app's page in the system settings, where a denied permission can be changed. */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}
