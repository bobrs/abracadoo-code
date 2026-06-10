import type { SecretRef } from "../humankey/model/types";
import type { CreateSecretInput, SecretVault } from "./SecretVault";

export class InMemorySecretVault implements SecretVault {
  private readonly secrets = new Map<SecretRef, Uint8Array>();

  async createSecret(input: CreateSecretInput): Promise<SecretRef> {
    const ref = `secret:${input.purpose}:${crypto.randomUUID()}` as SecretRef;
    this.secrets.set(ref, input.material);
    return ref;
  }

  async readSecret(ref: SecretRef): Promise<Uint8Array> {
    const value = this.secrets.get(ref);
    if (!value) {
      throw new Error(`Secret not found: ${ref}`);
    }
    return value;
  }

  async deleteSecret(ref: SecretRef): Promise<void> {
    this.secrets.delete(ref);
  }
}
