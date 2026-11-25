import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { notificationKeys } from '../api/notifications';
import { openTarget, parsePushTarget } from './navigation';

/**
 * With the app open a push still shows as a banner with sound (contracts/screens.md → Push en
 * primer plano). Called once when the root layout module loads, before any push can arrive.
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** The same tap can arrive through the listener and through the launch response. */
let lastHandledResponse: string | null = null;
/** The launch response is looked at once per app run. */
let launchResponseChecked = false;

/** A push tapped while signed out is dropped (research.md R10): call it on reaching the login. */
export function discardLaunchResponse(): void {
  launchResponseChecked = true;
}

function openResponse(response: Notifications.NotificationResponse): void {
  const key = `${response.notification.request.identifier}:${response.notification.date}`;
  if (key === lastHandledResponse) return;
  lastHandledResponse = key;
  void openTarget(parsePushTarget(response.notification.request.content.data));
}

/**
 * Push listeners (research.md R10). Mounted in the signed-in layout, so the push that opened a
 * closed app is handled after the session is restored, and a tap without a session is dropped
 * (the login guard applies):
 * - a received push refreshes the history;
 * - tapping a push (app open or in the background) opens its screen;
 * - the push that launched the app opens its screen once.
 */
export function useNotifications(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(openResponse);
    if (!launchResponseChecked) {
      launchResponseChecked = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response !== null) openResponse(response);
      });
    }
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [queryClient]);
}
