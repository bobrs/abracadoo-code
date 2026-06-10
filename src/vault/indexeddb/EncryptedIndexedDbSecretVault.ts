import type { SecretRef } from "../../humankey/model/types";
import { getAllRecords, getRecord, putRecord, deleteRecord } from "../../adapters/storage/indexeddb/idb";
import type { CreateSecretInput, UnlockableSecretVault } from "../SecretVault";
import type { EncryptedPayload } from "../crypto/passphraseCrypto";
import { decryptBytesWithPassphrase, encryptBytesWithPassphrase } from "../crypto/passphraseCrypto";

const VAULT_META_ID = "__abracadoo_encrypted_vault_meta__";
const VAULT_CHECK_TEXT = "abracadoo-vault-check-v1";

type VaultMetaRecord = {
  id: typeof VAULT_META_ID;
  type: "encrypted_vault_meta";
  createdAt: string;
  check: EncryptedPayload;
};

type PlainSecretRecord = {
  id: SecretRef;
  purpose: CreateSecretInput["purpose"];
  material: number[];
  createdAt: string;
};

type EncryptedSecretRecord = {
  id: SecretRef;
  type: "encrypted_secret";
  purpose: CreateSecretInput["purpose"];
  encryptedMaterial: EncryptedPayload;
  createdAt: string;
};

type SecretStoreRecord = VaultMetaRecord | PlainSecretRecord | EncryptedSecretRecord;

function isVaultMetaRecord(record: unknown): record is VaultMetaRecord {
  return Boolean(record && typeof record === "object" && (record as { type?: unknown }).type === "encrypted_vault_meta");
}

function isEncryptedSecretRecord(record: unknown): record is EncryptedSecretRecord {
  return Boolean(record && typeof record === "object" && (record as { type?: unknown }).type === "encrypted_secret");
}

function isPlainSecretRecord(record: unknown): record is PlainSecretRecord {
  return Boolean(
    record &&
      typeof record === "object" &&
      !isVaultMetaRecord(record) &&
      !isEncryptedSecretRecord(record) &&
      Array.isArray((record as { material?: unknown }).material)
  );
}

export class EncryptedIndexedDbSecretVault implements UnlockableSecretVault {
  private passphrase: string | undefined;

  isUnlocked(): boolean {
    return this.passphrase !== undefined;
  }

  async hasVault(): Promise<boolean> {
    const meta = await getRecord<SecretStoreRecord>("secrets", VAULT_META_ID);
    return isVaultMetaRecord(meta);
  }

  async initialize(passphrase: string): Promise<void> {
    this.assertPassphrase(passphrase);
    const existingMeta = await this.getMeta();
    if (existingMeta) {
      await this.unlock(passphrase);
      return;
    }

    const check = await encryptBytesWithPassphrase(new TextEncoder().encode(VAULT_CHECK_TEXT), passphrase);
    const meta: VaultMetaRecord = {
      id: VAULT_META_ID,
      type: "encrypted_vault_meta",
      createdAt: new Date().toISOString(),
      check,
    };
    await putRecord("secrets", meta);
    this.passphrase = passphrase;
    await this.migratePlaintextSecrets();
  }

  async unlock(passphrase: string): Promise<void> {
    this.assertPassphrase(passphrase);
    const meta = await this.getMeta();
    if (!meta) {
      await this.initialize(passphrase);
      return;
    }

    const check = await decryptBytesWithPassphrase(meta.check, passphrase);
    const decoded = new TextDecoder().decode(check);
    if (decoded !== VAULT_CHECK_TEXT) {
      throw new Error("Vault passphrase did not unlock the local vault.");
    }
    this.passphrase = passphrase;
    await this.migratePlaintextSecrets();
  }

  lock(): void {
    this.passphrase = undefined;
  }

  async createSecret(input: CreateSecretInput): Promise<SecretRef> {
    const passphrase = this.requireUnlocked();
    const id = `secret_${crypto.randomUUID()}`;
    const encryptedMaterial = await encryptBytesWithPassphrase(input.material, passphrase);
    const record: EncryptedSecretRecord = {
      id,
      type: "encrypted_secret",
      purpose: input.purpose,
      encryptedMaterial,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await putRecord("secrets", record);
    return id;
  }

  async readSecret(ref: SecretRef): Promise<Uint8Array> {
    const passphrase = this.requireUnlocked();
    const record = await getRecord<SecretStoreRecord>("secrets", ref);
    if (!record) throw new Error(`Secret not found: ${ref}`);

    if (isEncryptedSecretRecord(record)) {
      return decryptBytesWithPassphrase(record.encryptedMaterial, passphrase);
    }

    if (isPlainSecretRecord(record)) {
      const material = new Uint8Array(record.material);
      await this.replacePlainSecretWithEncrypted(record, passphrase);
      return material;
    }

    throw new Error(`Invalid secret record: ${ref}`);
  }

  async deleteSecret(ref: SecretRef): Promise<void> {
    await deleteRecord("secrets", ref);
  }

  private async getMeta(): Promise<VaultMetaRecord | null> {
    const record = await getRecord<SecretStoreRecord>("secrets", VAULT_META_ID);
    return isVaultMetaRecord(record) ? record : null;
  }

  private assertPassphrase(passphrase: string): void {
    if (passphrase.length < 8) {
      throw new Error("Use a vault passphrase of at least 8 characters.");
    }
  }

  private requireUnlocked(): string {
    if (!this.passphrase) {
      throw new Error("Local vault is locked. Unlock it before using secret material.");
    }
    return this.passphrase;
  }

  private async migratePlaintextSecrets(): Promise<void> {
    const passphrase = this.requireUnlocked();
    const records = await getAllRecords<SecretStoreRecord>("secrets");
    const plaintextRecords = records.filter(isPlainSecretRecord);
    for (const record of plaintextRecords) {
      await this.replacePlainSecretWithEncrypted(record, passphrase);
    }
  }

  private async replacePlainSecretWithEncrypted(record: PlainSecretRecord, passphrase: string): Promise<void> {
    const encryptedMaterial = await encryptBytesWithPassphrase(new Uint8Array(record.material), passphrase);
    const encryptedRecord: EncryptedSecretRecord = {
      id: record.id,
      type: "encrypted_secret",
      purpose: record.purpose,
      encryptedMaterial,
      createdAt: record.createdAt,
    };
    await putRecord("secrets", encryptedRecord);
  }
}
