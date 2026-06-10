import type { SecretRef } from "../../humankey/model/types";
import type { CreateSecretInput, SecretVault } from "../SecretVault";
import { deleteRecord, getRecord, putRecord } from "../../adapters/storage/indexeddb/idb";

type SecretRecord = {
  id: SecretRef;
  purpose: CreateSecretInput["purpose"];
  material: number[];
  createdAt: string;
};

export class IndexedDbSecretVault implements SecretVault {
  async createSecret(input: CreateSecretInput): Promise<SecretRef> {
    const id = `secret_${crypto.randomUUID()}`;
    const record: SecretRecord = {
      id,
      purpose: input.purpose,
      material: Array.from(input.material),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await putRecord("secrets", record);
    return id;
  }

  async readSecret(ref: SecretRef): Promise<Uint8Array> {
    const record = await getRecord<SecretRecord>("secrets", ref);
    if (!record) throw new Error(`Secret not found: ${ref}`);
    return new Uint8Array(record.material);
  }

  async deleteSecret(ref: SecretRef): Promise<void> {
    await deleteRecord("secrets", ref);
  }
}
