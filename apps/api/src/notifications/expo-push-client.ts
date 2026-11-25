import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo } from 'expo-server-sdk';
import type { Env } from '../config/env.schema';
import type {
  PushClient,
  PushErrorKind,
  PushMessage,
  PushReceipt,
  PushTicket,
} from './push-client';

function errorKind(details: { error?: string } | undefined): PushErrorKind {
  return details?.error === 'DeviceNotRegistered' ? 'DeviceNotRegistered' : 'other';
}

/** Expo Push with expo-server-sdk: chunks and retries on HTTP 429 (spec 006 research.md R5). */
@Injectable()
export class ExpoPushClient implements PushClient {
  private readonly expo: Expo;

  constructor(config: ConfigService<Env, true>) {
    const accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true });
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      const results = await this.expo.sendPushNotificationsAsync(chunk);
      for (const ticket of results) {
        tickets.push(
          ticket.status === 'ok'
            ? { status: 'ok', id: ticket.id }
            : { status: 'error', error: errorKind(ticket.details) },
        );
      }
    }
    return tickets;
  }

  async receipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    const result = new Map<string, PushReceipt>();
    for (const chunk of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        result.set(
          id,
          receipt.status === 'ok'
            ? { status: 'ok' }
            : { status: 'error', error: errorKind(receipt.details) },
        );
      }
    }
    return result;
  }
}
