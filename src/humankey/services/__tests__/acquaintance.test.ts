import { describe, expect, it } from "vitest";
import { createLocalRuntime } from "../../../runtime/createLocalRuntime";
import {
  createAcquaintanceWithTotp,
  createInboundPath,
  decryptEncryptedHumanKeyBackup,
  exportEncryptedHumanKeyBackup,
  exportHumanKeyBackup,
  importHumanKeyBackup,
  importPathInvite,
  createManualMessage,
  importManualMessage,
  revokeCredential,
  recordPathShared,
  verifyAcquaintanceCode,
} from "..";
import type { AbracadooRuntime } from "../../../runtime/AbracadooRuntime";
import type { CreateSecretInput, SecretVault } from "../../../vault/SecretVault";
import type { HumanKeyEvent, HumanKeyTotpCredential, SecretRef } from "../../model/types";
import { generateTotp } from "../../profiles/hk-totp-1/totp";

const FIXED_TIMESTAMP_MS = Date.UTC(2026, 5, 10, 2, 30, 0);

async function createVerifiedAcquaintance() {
  const runtime = createLocalRuntime();
  const created = await createAcquaintanceWithTotp(runtime, { displayName: "Alice" });
  const credential = created.credential as HumanKeyTotpCredential;
  const secret = await runtime.vault.readSecret(credential.secretRef);
  const code = await generateTotp({ secret, timestampMs: FIXED_TIMESTAMP_MS });
  return { runtime, contact: created.contact, credential, code };
}

class RecordingSecretVault implements SecretVault {
  readonly created: CreateSecretInput[] = [];

  constructor(private readonly inner: SecretVault) {}

  async createSecret(input: CreateSecretInput): Promise<SecretRef> {
    const recorded: CreateSecretInput = {
      purpose: input.purpose,
      material: new Uint8Array(input.material),
    };
    if (input.createdAt !== undefined) recorded.createdAt = input.createdAt;
    this.created.push(recorded);
    return this.inner.createSecret(input);
  }

  readSecret(ref: SecretRef): Promise<Uint8Array> {
    return this.inner.readSecret(ref);
  }

  deleteSecret(ref: SecretRef): Promise<void> {
    return this.inner.deleteSecret(ref);
  }
}

class LockedSecretVault extends RecordingSecretVault {
  readSecret(_ref: SecretRef): Promise<Uint8Array> {
    throw new Error("Local vault is locked. Unlock it before using secret material.");
  }
}

function createRuntimeWithRecordingVault(): { runtime: AbracadooRuntime; vault: RecordingSecretVault } {
  const runtime = createLocalRuntime();
  const vault = new RecordingSecretVault(runtime.vault);
  runtime.vault = vault;
  return { runtime, vault };
}

async function createManualExchangePair() {
  const aliceRuntime = createLocalRuntime();
  const bobRuntime = createLocalRuntime();

  const aliceViewOfBob = await createAcquaintanceWithTotp(aliceRuntime, { displayName: "Bob" });
  const bobViewOfAlice = await createAcquaintanceWithTotp(bobRuntime, { displayName: "Alice" });

  const aliceInbound = await createInboundPath(aliceRuntime, { contactId: aliceViewOfBob.contact.id });
  const bobInbound = await createInboundPath(bobRuntime, { contactId: bobViewOfAlice.contact.id });

  const aliceInvite = await recordPathShared(aliceRuntime, aliceInbound.path.id);
  const bobInvite = await recordPathShared(bobRuntime, bobInbound.path.id);

  const bobOutbound = await importPathInvite(bobRuntime, { contactId: bobViewOfAlice.contact.id, invite: aliceInvite });
  const aliceOutbound = await importPathInvite(aliceRuntime, { contactId: aliceViewOfBob.contact.id, invite: bobInvite });

  return { aliceRuntime, bobRuntime, aliceViewOfBob, bobViewOfAlice, aliceOutbound, bobOutbound };
}

function countEvents(events: HumanKeyEvent[], type: HumanKeyEvent["type"]): number {
  return events.filter((event) => event.type === type).length;
}

describe("HumanKey Acquaintance HK_TOTP_1", () => {
  it("validates a valid code and records a verification event", async () => {
    const { runtime, contact, credential, code } = await createVerifiedAcquaintance();

    const result = await verifyAcquaintanceCode(runtime, {
      contactId: contact.id,
      credentialId: credential.id,
      code,
      timestampMs: FIXED_TIMESTAMP_MS,
    });

    expect(result.valid).toBe(true);
    expect(result.event.type).toBe("credential.verified");

    const storedCredential = await runtime.storage.getCredential(credential.id);
    expect(storedCredential?.lifecycle.lastVerifiedAt).toBeDefined();

    const storedContact = await runtime.storage.getContact(contact.id);
    expect(storedContact?.state).toBe("acquaintance");
  });

  it("rejects an invalid code without establishing a relationship", async () => {
    const { runtime, contact, credential } = await createVerifiedAcquaintance();

    const result = await verifyAcquaintanceCode(runtime, {
      contactId: contact.id,
      credentialId: credential.id,
      code: "000000",
      timestampMs: FIXED_TIMESTAMP_MS,
    });

    expect(result.valid).toBe(false);
    expect(result.event.type).toBe("credential.failed_verification");

    const storedContact = await runtime.storage.getContact(contact.id);
    expect(storedContact?.state).not.toBe("relationship");
  });

  it("does not verify after credential revocation", async () => {
    const { runtime, contact, credential, code } = await createVerifiedAcquaintance();
    await revokeCredential(runtime, credential.id);

    const result = await verifyAcquaintanceCode(runtime, {
      contactId: contact.id,
      credentialId: credential.id,
      code,
      timestampMs: FIXED_TIMESTAMP_MS,
    });

    expect(result.valid).toBe(false);
    expect(result.event.type).toBe("credential.failed_verification");
  });


  it("can export after revocation without requiring deleted secret material", async () => {
    const { runtime, credential } = await createVerifiedAcquaintance();
    await revokeCredential(runtime, credential.id);

    const backup = await exportHumanKeyBackup(runtime);

    expect(backup.credentials).toHaveLength(1);
    expect(backup.credentials[0]?.lifecycle.revokedAt).toBeDefined();
    expect(backup.secrets).toHaveLength(0);
  });

  it("exports and imports backup while preserving verification ability", async () => {
    const { runtime, contact, credential, code } = await createVerifiedAcquaintance();
    const backup = await exportHumanKeyBackup(runtime);

    const restoredRuntime = createLocalRuntime();
    const importResult = await importHumanKeyBackup(restoredRuntime, backup);

    expect(importResult.contactsImported).toBe(1);
    expect(importResult.credentialsImported).toBe(1);
    expect(importResult.secretsImported).toBe(1);

    const result = await verifyAcquaintanceCode(restoredRuntime, {
      contactId: contact.id,
      credentialId: credential.id,
      code,
      timestampMs: FIXED_TIMESTAMP_MS,
    });

    expect(result.valid).toBe(true);
  });

  it("exports and imports encrypted backup while preserving verification ability", async () => {
    const { runtime, contact, credential, code } = await createVerifiedAcquaintance();
    const encryptedBackup = await exportEncryptedHumanKeyBackup(runtime, "test-backup-passphrase");

    expect(encryptedBackup.schema).toBe("ABRACADOO_HUMANKEY_ENCRYPTED_BACKUP");
    expect(JSON.stringify(encryptedBackup)).not.toContain(String(code));

    const decryptedBackup = await decryptEncryptedHumanKeyBackup(encryptedBackup, "test-backup-passphrase");
    const restoredRuntime = createLocalRuntime();
    await importHumanKeyBackup(restoredRuntime, decryptedBackup);

    const result = await verifyAcquaintanceCode(restoredRuntime, {
      contactId: contact.id,
      credentialId: credential.id,
      code,
      timestampMs: FIXED_TIMESTAMP_MS,
    });

    expect(result.valid).toBe(true);
  });

  it("creates, shares, exports, and imports path invites without establishing a relationship", async () => {
    const { runtime, contact } = await createVerifiedAcquaintance();

    const createdPath = await createInboundPath(runtime, { contactId: contact.id });
    expect(createdPath.path.direction).toBe("inbound");
    expect(createdPath.invite.schema).toBe("ABRACADOO_HUMANKEY_PATH_INVITE");

    const sharedInvite = await recordPathShared(runtime, createdPath.path.id);
    expect(sharedInvite.path.inviteId).toBe(createdPath.path.id);

    const storedAfterShare = await runtime.storage.getContact(contact.id);
    expect(storedAfterShare?.state).toBe("loop_offered");
    expect(storedAfterShare?.state).not.toBe("relationship");

    const restoredRuntime = createLocalRuntime();
    const restored = await createAcquaintanceWithTotp(restoredRuntime, { displayName: "Bob" });
    const imported = await importPathInvite(restoredRuntime, { contactId: restored.contact.id, invite: sharedInvite });

    expect(imported.path.direction).toBe("outbound");
    expect(imported.path.transport.kind).toBe("local");

    const restoredContact = await restoredRuntime.storage.getContact(restored.contact.id);
    expect(restoredContact?.state).toBe("loop_offered");
    expect(restoredContact?.state).not.toBe("relationship");
  });

  it("does not create receive-key secret material when importing a path invite", async () => {
    const receiverRuntime = createLocalRuntime();
    const receiver = await createAcquaintanceWithTotp(receiverRuntime, { displayName: "Receiver" });
    const receiverInbound = await createInboundPath(receiverRuntime, { contactId: receiver.contact.id });
    const receiverInvite = await recordPathShared(receiverRuntime, receiverInbound.path.id);

    const { runtime: senderRuntime, vault } = createRuntimeWithRecordingVault();
    const sender = await createAcquaintanceWithTotp(senderRuntime, { displayName: "Sender" });
    const createdBeforeImport = vault.created.length;
    const pathKeyCreatesBeforeImport = vault.created.filter((secret) => secret.purpose === "HK_PATH_1_RECEIVE_KEY").length;

    await importPathInvite(senderRuntime, { contactId: sender.contact.id, invite: receiverInvite });

    expect(vault.created).toHaveLength(createdBeforeImport);
    expect(vault.created.filter((secret) => secret.purpose === "HK_PATH_1_RECEIVE_KEY")).toHaveLength(pathKeyCreatesBeforeImport);
  });

  it("does not establish a Relationship after sent-only manual exchange", async () => {
    const { aliceRuntime, aliceViewOfBob, aliceOutbound } = await createManualExchangePair();

    await createManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      outboundPathId: aliceOutbound.path.id,
      plaintext: "Sent only.",
    });

    const aliceContact = await aliceRuntime.storage.getContact(aliceViewOfBob.contact.id);
    const aliceEvents = await aliceRuntime.storage.listEventsForContact(aliceViewOfBob.contact.id);
    expect(aliceContact?.state).not.toBe("relationship");
    expect(countEvents(aliceEvents, "loop.completed")).toBe(0);
    expect(countEvents(aliceEvents, "relationship.established")).toBe(0);
  });

  it("does not establish a Relationship after received-only manual exchange", async () => {
    const { aliceRuntime, bobRuntime, aliceViewOfBob, bobViewOfAlice, bobOutbound } = await createManualExchangePair();

    const bobMessage = await createManualMessage(bobRuntime, {
      contactId: bobViewOfAlice.contact.id,
      outboundPathId: bobOutbound.path.id,
      plaintext: "Received only.",
    });
    const aliceImport = await importManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      artifact: bobMessage.artifact,
    });

    const aliceContact = await aliceRuntime.storage.getContact(aliceViewOfBob.contact.id);
    const aliceEvents = await aliceRuntime.storage.listEventsForContact(aliceViewOfBob.contact.id);
    expect(aliceImport.relationshipEstablished).toBe(false);
    expect(aliceContact?.state).not.toBe("relationship");
    expect(countEvents(aliceEvents, "loop.completed")).toBe(0);
    expect(countEvents(aliceEvents, "relationship.established")).toBe(0);
  });

  it("exchanges encrypted manual messages and establishes a Relationship after a witnessed Loop", async () => {
    const { aliceRuntime, bobRuntime, aliceViewOfBob, bobViewOfAlice, aliceOutbound, bobOutbound } = await createManualExchangePair();

    const aliceMessageText = "Hello Bob. This crossed a manual path.";
    const bobMessageText = "Hello Alice. Loop witnessed.";

    const aliceMessage = await createManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      outboundPathId: aliceOutbound.path.id,
      plaintext: aliceMessageText,
    });
    const bobMessage = await createManualMessage(bobRuntime, {
      contactId: bobViewOfAlice.contact.id,
      outboundPathId: bobOutbound.path.id,
      plaintext: bobMessageText,
    });

    expect(JSON.stringify(aliceMessage.artifact)).not.toContain(aliceMessageText);
    expect(JSON.stringify(bobMessage.artifact)).not.toContain(bobMessageText);

    const aliceImport = await importManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      artifact: bobMessage.artifact,
    });
    const bobImport = await importManualMessage(bobRuntime, {
      contactId: bobViewOfAlice.contact.id,
      artifact: aliceMessage.artifact,
    });

    expect(aliceImport.plaintext).toBe(bobMessageText);
    expect(bobImport.plaintext).toBe(aliceMessageText);
    expect(aliceImport.relationshipEstablished).toBe(true);
    expect(bobImport.relationshipEstablished).toBe(true);

    const aliceContact = await aliceRuntime.storage.getContact(aliceViewOfBob.contact.id);
    const bobContact = await bobRuntime.storage.getContact(bobViewOfAlice.contact.id);
    expect(aliceContact?.state).toBe("relationship");
    expect(bobContact?.state).toBe("relationship");

    let aliceEvents = await aliceRuntime.storage.listEventsForContact(aliceViewOfBob.contact.id);
    expect(countEvents(aliceEvents, "loop.completed")).toBe(1);
    expect(countEvents(aliceEvents, "relationship.established")).toBe(1);

    await createManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      outboundPathId: aliceOutbound.path.id,
      plaintext: "A later sent message should not duplicate witness events.",
    });
    await importManualMessage(aliceRuntime, {
      contactId: aliceViewOfBob.contact.id,
      artifact: bobMessage.artifact,
    });

    aliceEvents = await aliceRuntime.storage.listEventsForContact(aliceViewOfBob.contact.id);
    expect(countEvents(aliceEvents, "loop.completed")).toBe(1);
    expect(countEvents(aliceEvents, "relationship.established")).toBe(1);
  });

  it("exports and imports inbound path receive keys so manual messages still decrypt", async () => {
    const receiverRuntime = createLocalRuntime();
    const senderRuntime = createLocalRuntime();

    const receiverContact = await createAcquaintanceWithTotp(receiverRuntime, { displayName: "Sender" });
    const senderContact = await createAcquaintanceWithTotp(senderRuntime, { displayName: "Receiver" });
    const receiverInbound = await createInboundPath(receiverRuntime, { contactId: receiverContact.contact.id });
    const receiverInvite = await recordPathShared(receiverRuntime, receiverInbound.path.id);
    const senderOutbound = await importPathInvite(senderRuntime, { contactId: senderContact.contact.id, invite: receiverInvite });

    const artifact = (await createManualMessage(senderRuntime, {
      contactId: senderContact.contact.id,
      outboundPathId: senderOutbound.path.id,
      plaintext: "Restored vault path key works.",
    })).artifact;

    const backup = await exportHumanKeyBackup(receiverRuntime);
    const restoredReceiver = createLocalRuntime();
    await importHumanKeyBackup(restoredReceiver, backup);

    const imported = await importManualMessage(restoredReceiver, {
      contactId: receiverContact.contact.id,
      artifact,
    });

    expect(imported.plaintext).toBe("Restored vault path key works.");
  });

  it("restores path receive-key secret material with the path receive-key purpose", async () => {
    const receiverRuntime = createLocalRuntime();
    const receiverContact = await createAcquaintanceWithTotp(receiverRuntime, { displayName: "Sender" });
    await createInboundPath(receiverRuntime, { contactId: receiverContact.contact.id });

    const backup = await exportHumanKeyBackup(receiverRuntime);
    const { runtime: restoredRuntime, vault } = createRuntimeWithRecordingVault();
    await importHumanKeyBackup(restoredRuntime, backup);

    const restoredPaths = await restoredRuntime.storage.listPathsForContact(receiverContact.contact.id);
    expect(restoredPaths.some((path) => path.secretRef)).toBe(true);
    expect(vault.created.map((secret) => secret.purpose)).toContain("HK_TOTP_1");
    expect(vault.created.map((secret) => secret.purpose)).toContain("HK_PATH_1_RECEIVE_KEY");
  });

  it("uses stable manual-message error codes for malformed artifacts and wrong Paths", async () => {
    const { runtime, contact } = await createVerifiedAcquaintance();

    await expect(importManualMessage(runtime, { contactId: contact.id, artifact: { nope: true } })).rejects.toMatchObject({
      code: "MALFORMED_ARTIFACT",
    });

    await expect(
      importManualMessage(runtime, {
        contactId: contact.id,
        artifact: {
          schema: "ABRACADOO_HUMANKEY_MANUAL_MESSAGE",
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          note: "ENCRYPTED_MANUAL_MESSAGE_CONTAINS_NO_TOTP_SECRET_MATERIAL",
          message: {
            id: "message-missing-path",
            profile: "HK_MANUAL_MESSAGE_1",
            recipientPathId: "missing-path",
            createdAt: new Date().toISOString(),
            encryption: {
              algorithm: "ECDH-P256-AES-GCM",
              senderEphemeralPublicKeyJwk: {},
              iv: "AA==",
              ciphertext: "AA==",
            },
          },
        },
      })
    ).rejects.toMatchObject({ code: "WRONG_PATH" });
  });

  it("uses stable manual-message error codes for wrong recipient, locked vault, and failed decrypt", async () => {
    const receiverRuntime = createLocalRuntime();
    const senderRuntime = createLocalRuntime();

    const receiverContact = await createAcquaintanceWithTotp(receiverRuntime, { displayName: "Sender" });
    const otherReceiverContact = await createAcquaintanceWithTotp(receiverRuntime, { displayName: "Someone else" });
    const senderContact = await createAcquaintanceWithTotp(senderRuntime, { displayName: "Receiver" });
    const receiverInbound = await createInboundPath(receiverRuntime, { contactId: receiverContact.contact.id });
    const secondReceiverInbound = await createInboundPath(receiverRuntime, { contactId: receiverContact.contact.id });
    const receiverInvite = await recordPathShared(receiverRuntime, receiverInbound.path.id);
    const senderOutbound = await importPathInvite(senderRuntime, { contactId: senderContact.contact.id, invite: receiverInvite });

    const artifact = (await createManualMessage(senderRuntime, {
      contactId: senderContact.contact.id,
      outboundPathId: senderOutbound.path.id,
      plaintext: "Manual message error confidence.",
    })).artifact;

    await expect(
      importManualMessage(receiverRuntime, {
        contactId: otherReceiverContact.contact.id,
        artifact,
      })
    ).rejects.toMatchObject({ code: "WRONG_RECIPIENT" });

    const wrongKeyArtifact = structuredClone(artifact);
    wrongKeyArtifact.message.recipientPathId = secondReceiverInbound.path.id;
    await expect(
      importManualMessage(receiverRuntime, {
        contactId: receiverContact.contact.id,
        artifact: wrongKeyArtifact,
      })
    ).rejects.toMatchObject({ code: "DECRYPT_FAILED" });

    receiverRuntime.vault = new LockedSecretVault(receiverRuntime.vault);
    await expect(
      importManualMessage(receiverRuntime, {
        contactId: receiverContact.contact.id,
        artifact,
      })
    ).rejects.toMatchObject({ code: "VAULT_LOCKED" });
  });

});
