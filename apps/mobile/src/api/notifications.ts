import type { PushTarget } from '@corte/domain';
import { apiFetch } from './client';

/** `NotificationKind` of specs/006-alerts-reminders/contracts/notifications.openapi.yaml. */
export type NotificationKind =
  'budget_alert' | 'cutoff_reminder' | 'payment_reminder' | 'recurring_reminder';

/** `NotificationTarget`: the screen a history row opens. */
export interface NotificationTarget {
  type: 'card' | 'statement' | 'occurrence';
  id: string;
}

/** `Notification` of contracts/notifications.openapi.yaml: one row of the history. */
export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO 8601 instant. */
  createdAt: string;
  target: NotificationTarget;
}

export type { PushTarget };

export type DevicePlatform = 'ios' | 'android';

/** Every key lives under ['notifications'], so a received push refreshes them all. */
export const notificationKeys = {
  all: ['notifications'] as const,
  history: () => ['notifications', 'history'] as const,
};

/** Binds this Expo push token to the current session (upsert by token). */
export function registerDevice(token: string, platform: DevicePlatform): Promise<void> {
  return apiFetch<void>('/devices', { method: 'POST', body: { token, platform } });
}

/** Removes the devices of the current session; answers 204 even if there were none. */
export function unregisterCurrentDevice(): Promise<void> {
  return apiFetch<void>('/devices/current', { method: 'DELETE' });
}

/** Notifications of the last 30 days, newest first (at most 200). */
export async function getNotifications(): Promise<Notification[]> {
  const { items } = await apiFetch<{ items: Notification[] }>('/notifications');
  return items;
}

/** Test push to this session's devices: 409, 429 (with retryAfterSeconds) or 502 on failure. */
export function sendTestNotification(): Promise<{ sent: number }> {
  return apiFetch<{ sent: number }>('/notifications/test', { method: 'POST' });
}
