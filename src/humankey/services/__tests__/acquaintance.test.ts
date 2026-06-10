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
import type { HumanKeyTotpCredential } from "../../model/types";
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


  it("exchanges encrypted manual messages and establishes a Relationship after a witnessed Loop", async () => {
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

});
