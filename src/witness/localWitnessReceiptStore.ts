import { getRecord, putRecord } from "../adapters/storage/indexeddb/idb";
import type { AuthorizationOffer } from "./authorizationOffers";

export type StoredWitnessReceipt = {
  id: string;
  offerId: string;
  participantRef: string;
  storedAt: string;
  returnUrl?: string;
  offerSummary: {
    issuerName?: string;
    issuerOrigin?: string;
    eventType?: string;
    payloadHash?: string;
    payloadLabel?: string;
  };
  receipt: unknown;
};

function witnessReceiptId(offerId: string): string {
  return `witness-receipt:${offerId}`;
}

function omitUndefined<T extends Record<string, string | undefined>>(value: T): { [K in keyof T]?: string } {
  const result: Partial<Record<keyof T, string>> = {};
  for (const [key, entry] of Object.entries(value) as [keyof T, string | undefined][]) {
    if (entry !== undefined) result[key] = entry;
  }
  return result as { [K in keyof T]?: string };
}

export async function getStoredWitnessReceipt(offerId: string): Promise<StoredWitnessReceipt | null> {
  return getRecord<StoredWitnessReceipt>("witnessReceipts", witnessReceiptId(offerId));
}

export async function saveWitnessReceipt(input: {
  offer: AuthorizationOffer;
  participantRef: string;
  receipt: unknown;
  storedAt?: string;
}): Promise<StoredWitnessReceipt> {
  const record = {
    id: witnessReceiptId(input.offer.offerId),
    offerId: input.offer.offerId,
    participantRef: input.participantRef,
    storedAt: input.storedAt ?? new Date().toISOString(),
    offerSummary: omitUndefined({
      issuerName: input.offer.issuerName,
      issuerOrigin: input.offer.issuerOrigin,
      eventType: input.offer.eventType,
      payloadHash: input.offer.payloadHash,
      payloadLabel: input.offer.payloadLabel,
    }),
    receipt: input.receipt,
    ...(input.offer.returnUrl ? { returnUrl: input.offer.returnUrl } : {}),
  } satisfies StoredWitnessReceipt;
  await putRecord("witnessReceipts", record);
  return record;
}
