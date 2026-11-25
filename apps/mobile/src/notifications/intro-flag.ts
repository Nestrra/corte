import * as SecureStore from 'expo-secure-store';

/**
 * Whether this device already showed "Activa las notificaciones" (research.md R13). It belongs to
 * the device, not to the user: the explanation appears once, whoever signs in.
 */
const KEY = 'corte.notificationsIntroSeen';

export async function notificationsIntroSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    // An unreadable keychain must not block the app: the intro simply shows again.
    return false;
  }
}

export async function markNotificationsIntroSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    // Worst case the intro shows once more; "Ahora no" still works.
  }
}
