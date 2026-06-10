import type { SecretRef } from "../humankey/model/types";

export type CreateSecretInput = {
  purpose: "HK_TOTP_1" | "HK_APP_KEY_1" | "OTHER";
  material: Uint8Array;
  createdAt?: string;
};

export interface SecretVault {
  createSecret(input: CreateSecretInput): Promise<SecretRef>;
  readSecret(ref: SecretRef): Promise<Uint8Array>;
  deleteSecret(ref: SecretRef): Promise<void>;
}
