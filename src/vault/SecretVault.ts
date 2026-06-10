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

export interface UnlockableSecretVault extends SecretVault {
  isUnlocked(): boolean;
  hasVault(): Promise<boolean>;
  initialize(passphrase: string): Promise<void>;
  unlock(passphrase: string): Promise<void>;
  lock(): void;
}

export function isUnlockableSecretVault(vault: SecretVault): vault is UnlockableSecretVault {
  const candidate = vault as Partial<UnlockableSecretVault>;
  return (
    typeof candidate.isUnlocked === "function" &&
    typeof candidate.hasVault === "function" &&
    typeof candidate.initialize === "function" &&
    typeof candidate.unlock === "function" &&
    typeof candidate.lock === "function"
  );
}
