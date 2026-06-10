import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";
import type { HumanKeyContact, HumanKeyEvent, HumanKeyPath, MessageId, PathId } from "../model/types";

export type ManualMessageArtifact = {
  schema: "ABRACADOO_HUMANKEY_MANUAL_MESSAGE";
  schemaVersion: 1;
  exportedAt: string;
  note: "ENCRYPTED_MANUAL_MESSAGE_CONTAINS_NO_TOTP_SECRET_MATERIAL";
  message: {
    id: MessageId;
    profile: "HK_MANUAL_MESSAGE_1";
    recipientPathId: PathId;
    createdAt: string;
    encryption: {
      algorithm: "ECDH-P256-AES-GCM";
      senderEphemeralPublicKeyJwk: JsonWebKey;
      iv: string;
      ciphertext: string;
    };
  };
};

export type CreateManualMessageInput = {
  contactId: string;
  outboundPathId: string;
  plaintext: string;
};

export type CreateManualMessageResult = {
  contact: HumanKeyContact;
  event: HumanKeyEvent;
  artifact: ManualMessageArtifact;
};

export type ImportManualMessageInput = {
  contactId: string;
  artifact: unknown;
};

export type ImportManualMessageResult = {
  contact: HumanKeyContact;
  event: HumanKeyEvent;
  plaintext: string;
  loopCompleted: boolean;
  relationshipEstablished: boolean;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function canonicalDigestInput(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}

async function sha256Base64(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(canonicalDigestInput(value)));
  return bytesToBase64(new Uint8Array(digest));
}

function serializeJwk(jwk: JsonWebKey): Uint8Array {
  return textEncoder.encode(JSON.stringify(jwk));
}

function deserializeJwk(bytes: Uint8Array): JsonWebKey {
  return JSON.parse(textDecoder.decode(bytes)) as JsonWebKey;
}

async function deriveAesKeyFromSender(otherPublicJwk: JsonWebKey): Promise<{ key: CryptoKey; ephemeralPublicJwk: JsonWebKey }> {
  const otherPublicKey = await crypto.subtle.importKey(
    "jwk",
    otherPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: otherPublicKey },
    ephemeral.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ephemeralPublicJwk = await crypto.subtle.exportKey("jwk", ephemeral.publicKey);
  return { key, ephemeralPublicJwk };
}

async function deriveAesKeyFromRecipient(privateJwk: JsonWebKey, senderEphemeralPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );
  const senderPublicKey = await crypto.subtle.importKey(
    "jwk",
    senderEphemeralPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: senderPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

function assertManualMessageArtifact(value: unknown): asserts value is ManualMessageArtifact {
  if (!value || typeof value !== "object") throw new Error("Manual message is not an object.");
  const candidate = value as Partial<ManualMessageArtifact>;
  if (candidate.schema !== "ABRACADOO_HUMANKEY_MANUAL_MESSAGE" || candidate.schemaVersion !== 1) {
    throw new Error("Unsupported Abracadoo HumanKey manual message schema.");
  }
  if (!candidate.message || candidate.message.profile !== "HK_MANUAL_MESSAGE_1") {
    throw new Error("Manual message is missing its HK_MANUAL_MESSAGE_1 payload.");
  }
  if (!candidate.message.encryption || candidate.message.encryption.algorithm !== "ECDH-P256-AES-GCM") {
    throw new Error("Manual message encryption payload is missing or unsupported.");
  }
}

async function saveContactWithDerivedState(runtime: AbracadooRuntime, contact: HumanKeyContact): Promise<HumanKeyContact> {
  const events = await runtime.storage.listEventsForContact(contact.id);
  const state = deriveContactState(contact, events);
  const updated = { ...contact, state, updatedAt: runtime.clock.nowIso() };
  await runtime.storage.saveContact(updated);
  return updated;
}

async function witnessLoopIfReady(runtime: AbracadooRuntime, contact: HumanKeyContact): Promise<{ contact: HumanKeyContact; loopCompleted: boolean; relationshipEstablished: boolean }> {
  const events = await runtime.storage.listEventsForContact(contact.id);
  const hasSent = events.some((event) => event.type === "message.sent");
  const hasReceived = events.some((event) => event.type === "message.received");
  const hasLoopCompleted = events.some((event) => event.type === "loop.completed");
  const hasRelationshipEstablished = events.some((event) => event.type === "relationship.established");

  if (!hasSent || !hasReceived || hasLoopCompleted || hasRelationshipEstablished) {
    return { contact: await saveContactWithDerivedState(runtime, contact), loopCompleted: false, relationshipEstablished: false };
  }

  const nowIso = runtime.clock.nowIso();
  const loopEvent = createHumanKeyEvent({
    contactId: contact.id,
    type: "loop.completed",
    nowIso,
    data: { basis: "manual_message_exchange", messageSent: true, messageReceived: true },
  });
  const relationshipEvent = createHumanKeyEvent({
    contactId: contact.id,
    type: "relationship.established",
    nowIso,
    data: { basis: "witnessed_loop", loopEventId: loopEvent.id },
  });

  await runtime.storage.appendEvent(loopEvent);
  await runtime.storage.appendEvent(relationshipEvent);

  const updated: HumanKeyContact = {
    ...contact,
    eventIds: [...contact.eventIds, loopEvent.id, relationshipEvent.id],
    state: "relationship",
    establishedRelationshipAt: nowIso,
    updatedAt: nowIso,
  };
  await runtime.storage.saveContact(updated);
  return { contact: updated, loopCompleted: true, relationshipEstablished: true };
}

export async function generateInboundPathReceiveKey(runtime: AbracadooRuntime): Promise<{ secretRef: string; publicKeyJwk: JsonWebKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const secretRef = await runtime.vault.createSecret({
    purpose: "HK_PATH_1_RECEIVE_KEY",
    material: serializeJwk(privateKeyJwk),
    createdAt: runtime.clock.nowIso(),
  });
  return { secretRef, publicKeyJwk };
}

export async function createManualMessage(
  runtime: AbracadooRuntime,
  input: CreateManualMessageInput
): Promise<CreateManualMessageResult> {
  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");
  const outboundPath = await runtime.storage.getPath(input.outboundPathId);
  if (!outboundPath || outboundPath.contactId !== contact.id || outboundPath.direction !== "outbound") {
    throw new Error("Outbound path not found for this contact.");
  }
  if (outboundPath.lifecycle.revokedAt) throw new Error("Outbound path is revoked.");
  const receivePublicKeyJwk = outboundPath.transport.kind === "local" ? outboundPath.transport.receivePublicKeyJwk : undefined;
  if (!receivePublicKeyJwk) {
    throw new Error("Outbound path does not include manual message public-key material.");
  }

  const nowIso = runtime.clock.nowIso();
  const { key, ephemeralPublicJwk } = await deriveAesKeyFromSender(receivePublicKeyJwk);
  const iv = runtime.crypto.randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(textEncoder.encode(input.plaintext)));
  const messageId = runtime.crypto.randomId();
  const artifact: ManualMessageArtifact = {
    schema: "ABRACADOO_HUMANKEY_MANUAL_MESSAGE",
    schemaVersion: 1,
    exportedAt: nowIso,
    note: "ENCRYPTED_MANUAL_MESSAGE_CONTAINS_NO_TOTP_SECRET_MATERIAL",
    message: {
      id: messageId,
      profile: "HK_MANUAL_MESSAGE_1",
      recipientPathId: outboundPath.remotePathId ?? outboundPath.id,
      createdAt: nowIso,
      encryption: {
        algorithm: "ECDH-P256-AES-GCM",
        senderEphemeralPublicKeyJwk: ephemeralPublicJwk,
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      },
    },
  };

  const event = createHumanKeyEvent({
    contactId: contact.id,
    pathId: outboundPath.id,
    type: "message.sent",
    nowIso,
    data: {
      mode: "manual",
      messageId,
      encrypted: true,
      artifactDigest: await sha256Base64(artifact),
      plaintextLength: input.plaintext.length,
    },
  });
  await runtime.storage.appendEvent(event);
  const updated = { ...contact, eventIds: [...contact.eventIds, event.id], updatedAt: nowIso };
  await runtime.storage.saveContact(updated);
  const witnessed = await witnessLoopIfReady(runtime, updated);
  return { contact: witnessed.contact, event, artifact };
}

export async function importManualMessage(
  runtime: AbracadooRuntime,
  input: ImportManualMessageInput
): Promise<ImportManualMessageResult> {
  assertManualMessageArtifact(input.artifact);
  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");

  const inboundPath = await runtime.storage.getPath(input.artifact.message.recipientPathId);
  if (!inboundPath || inboundPath.contactId !== contact.id || inboundPath.direction !== "inbound") {
    throw new Error("No matching inbound path found for this manual message.");
  }
  if (!inboundPath.secretRef) throw new Error("Inbound path is missing private receive-key material.");

  const privateJwk = deserializeJwk(await runtime.vault.readSecret(inboundPath.secretRef));
  const aesKey = await deriveAesKeyFromRecipient(privateJwk, input.artifact.message.encryption.senderEphemeralPublicKeyJwk);
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(input.artifact.message.encryption.iv)) },
    aesKey,
    toArrayBuffer(base64ToBytes(input.artifact.message.encryption.ciphertext))
  );
  const plaintext = textDecoder.decode(plaintextBytes);

  const nowIso = runtime.clock.nowIso();
  const event = createHumanKeyEvent({
    contactId: contact.id,
    pathId: inboundPath.id,
    type: "message.received",
    nowIso,
    data: {
      mode: "manual",
      messageId: input.artifact.message.id,
      encrypted: true,
      artifactDigest: await sha256Base64(input.artifact),
      plaintextLength: plaintext.length,
      plaintextSha256: await sha256Base64(plaintext),
    },
  });

  await runtime.storage.appendEvent(event);
  const updated = { ...contact, eventIds: [...contact.eventIds, event.id], updatedAt: nowIso };
  await runtime.storage.saveContact(updated);
  const witnessed = await witnessLoopIfReady(runtime, updated);

  return {
    contact: witnessed.contact,
    event,
    plaintext,
    loopCompleted: witnessed.loopCompleted,
    relationshipEstablished: witnessed.relationshipEstablished,
  };
}
