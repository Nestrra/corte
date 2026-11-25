import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { registerDevice, unregisterCurrentDevice } from '../api/notifications';
import { useRefetchOnAppActive } from '../features/use-refetch-on-app-active';
import { useSessionStore } from '../session/session-store';
import { ensureDefaultChannel, getNotificationStatus } from './permission';

/**
 * What Perfil shows (contracts/screens.md → Estado en Perfil):
 * - `registered`: permission granted and this device bound to the session ("Activadas");
 * - `pending`: permission granted, token or registration still failing ("Activando…");
 * - `denied`, `undetermined`: the system permission;
 * - `unavailable`: the device cannot receive push (a simulator, for instance).
 */
export type NotificationStatus =
  'registered' | 'pending' | 'denied' | 'undetermined' | 'unavailable';

interface NotificationStatusState {
  status: NotificationStatus | null;
  setStatus: (status: NotificationStatus) => void;
}

export const useNotificationStatus = create<NotificationStatusState>()((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));

/** Errors of `getExpoPushTokenAsync` that a later try can fix (no network, Expo down). */
const TRANSIENT_TOKEN_ERRORS = new Set([
  'ERR_NOTIFICATIONS_NETWORK_ERROR',
  'ERR_NOTIFICATIONS_SERVER_ERROR',
]);

function isTransientTokenError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && TRANSIENT_TOKEN_ERRORS.has(code);
}

/** Set after a successful POST /devices, so a later denial removes the device once. */
let registeredThisRun = false;
let inFlight: Promise<NotificationStatus> | null = null;

async function sync(): Promise<NotificationStatus> {
  if (useSessionStore.getState().status !== 'signedIn') {
    registeredThisRun = false;
    const permission = await getNotificationStatus();
    return permission === 'granted' ? 'pending' : permission;
  }

  const permission = await getNotificationStatus();
  if (permission !== 'granted') {
    if (permission === 'denied' && registeredThisRun) {
      try {
        await unregisterCurrentDevice();
        registeredThisRun = false;
      } catch {
        // Retried on the next open; the job also stops sending once Expo reports the token.
      }
    }
    return permission;
  }

  let token: string;
  try {
    await ensureDefaultChannel();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    return isTransientTokenError(error) ? 'pending' : 'unavailable';
  }

  try {
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredThisRun = true;
    return 'registered';
  } catch {
    // No network or the API failed: "Activando…" until the next open or foreground.
    return 'pending';
  }
}

/**
 * Brings the device registration in line with the permission and the session (research.md R13)
 * and publishes the result in `useNotificationStatus`. Concurrent calls share one run.
 */
export function syncDevice(): Promise<NotificationStatus> {
  inFlight ??= sync()
    .then((status) => {
      useNotificationStatus.getState().setStatus(status);
      return status;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Runs `syncDevice` after sign-in (it is mounted inside the signed-in stack), when the app comes
 * back to the foreground and when the system hands out a new token. Expo push tokens are derived
 * from the device token, so a new one is fetched again rather than taken from the event.
 */
export function useDeviceRegistration(): void {
  useEffect(() => {
    void syncDevice();
    const subscription = Notifications.addPushTokenListener(() => void syncDevice());
    return () => subscription.remove();
  }, []);
  useRefetchOnAppActive(syncDevice);
}
