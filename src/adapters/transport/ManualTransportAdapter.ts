import type { ClockAdapter } from "../clock/ClockAdapter";
import type { TransportAdapter, TransportFilter, TransportMessage, TransportReceipt } from "./TransportAdapter";

export class ManualTransportAdapter implements TransportAdapter {
  readonly kind = "manual" as const;
  private readonly outbox: TransportMessage[] = [];

  constructor(private readonly clock: ClockAdapter) {}

  async send(message: TransportMessage): Promise<TransportReceipt> {
    this.outbox.push(structuredClone(message));
    return {
      messageId: message.id,
      transport: this.kind,
      acceptedAt: this.clock.nowIso(),
      receiptData: {
        mode: "manual",
        note: "Message staged for human-mediated exchange such as QR, copy/paste, phone, or printed code.",
      },
    };
  }

  async *receive(filter?: TransportFilter): AsyncIterable<TransportMessage> {
    for (const message of this.outbox) {
      if (filter?.kind && filter.kind !== message.kind) continue;
      if (filter?.since && message.createdAt < filter.since) continue;
      yield structuredClone(message);
    }
  }
}
