export type TransportKind = "manual" | "server" | "nostr" | "webpush" | "local";

export type TransportMessage = {
  id: string;
  kind: TransportKind;
  createdAt: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type TransportReceipt = {
  messageId: string;
  transport: TransportKind;
  acceptedAt: string;
  receiptData?: Record<string, unknown>;
};

export type TransportFilter = {
  kind?: TransportKind;
  since?: string;
  metadata?: Record<string, unknown>;
};

export interface TransportAdapter {
  readonly kind: TransportKind;
  send(message: TransportMessage): Promise<TransportReceipt>;
  receive(filter?: TransportFilter): AsyncIterable<TransportMessage>;
}

export type TransportAdapterRegistry = Partial<Record<TransportKind, TransportAdapter>>;
