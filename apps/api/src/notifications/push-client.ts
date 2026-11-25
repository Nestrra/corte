/**
 * The push service behind an interface (spec 006 research.md R5): Expo in production, a fake in
 * the e2e (`overrideProvider(PUSH_CLIENT)`).
 */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: 'default';
  /** Navigation data only (research.md R10); never the user id. */
  data: Record<string, unknown>;
}

export type PushErrorKind = 'DeviceNotRegistered' | 'other';

export type PushTicket = { status: 'ok'; id: string } | { status: 'error'; error: PushErrorKind };

export type PushReceipt = { status: 'ok' } | { status: 'error'; error: PushErrorKind };

export interface PushClient {
  /** One ticket per message, in the same order. Throws when the service cannot be reached. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  /** The receipts that are ready, by ticket id. */
  receipts(ticketIds: string[]): Promise<Map<string, PushReceipt>>;
}

export const PUSH_CLIENT = Symbol('PUSH_CLIENT');
