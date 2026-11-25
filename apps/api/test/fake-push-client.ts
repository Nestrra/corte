/**
 * Push client for the e2e (spec 006 research.md R5): records what would be sent and lets a test
 * program ticket errors, receipt errors or a failure of the whole call. No network.
 */
import type {
  PushClient,
  PushErrorKind,
  PushMessage,
  PushReceipt,
  PushTicket,
} from '../src/notifications/push-client';

export class FakePushClient implements PushClient {
  sent: PushMessage[] = [];
  private nextId = 1;
  private failing = false;
  private readonly ticketErrors = new Map<string, PushErrorKind>();
  private readonly receiptsById = new Map<string, PushReceipt>();
  /** Ticket id → token, for every `ok` ticket. */
  readonly ticketTokens = new Map<string, string>();
  receiptRequests: string[][] = [];

  /** Every `send` throws until `failSend(false)`. */
  failSend(failing = true): void {
    this.failing = failing;
  }

  /** The next tickets for this token come back with an error. */
  ticketError(token: string, error: PushErrorKind = 'DeviceNotRegistered'): void {
    this.ticketErrors.set(token, error);
  }

  /** The receipt of every ok ticket sent to this token. */
  receiptFor(token: string, receipt: PushReceipt): void {
    for (const [id, ticketToken] of this.ticketTokens) {
      if (ticketToken === token) this.receiptsById.set(id, receipt);
    }
  }

  /** Messages sent to one token. */
  to(token: string): PushMessage[] {
    return this.sent.filter((message) => message.to === token);
  }

  reset(): void {
    this.sent = [];
    this.failing = false;
    this.ticketErrors.clear();
    this.receiptsById.clear();
    this.ticketTokens.clear();
    this.receiptRequests = [];
  }

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    if (this.failing) throw new Error('Push service unavailable');
    this.sent.push(...messages);
    return messages.map((message) => {
      const error = this.ticketErrors.get(message.to);
      if (error) return { status: 'error', error };
      const id = `ticket-${this.nextId++}`;
      this.ticketTokens.set(id, message.to);
      return { status: 'ok', id };
    });
  }

  async receipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    this.receiptRequests.push(ticketIds);
    const result = new Map<string, PushReceipt>();
    for (const id of ticketIds) {
      const receipt = this.receiptsById.get(id);
      if (receipt) result.set(id, receipt);
    }
    return result;
  }
}
