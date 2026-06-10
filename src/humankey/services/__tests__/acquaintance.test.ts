import { describe, expect, it } from "vitest";
import { createLocalRuntime } from "../../../runtime/createLocalRuntime";
import {
  createAcquaintanceWithTotp,
  decryptEncryptedHumanKeyBackup,
  exportEncryptedHumanKeyBackup,
  exportHumanKeyBackup,
  importHumanKeyBackup,
  revokeCredential,
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

});
