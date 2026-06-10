import type { ContactId, CredentialId, HumanKeyTotpCredential } from "../../model/types";
import type { CryptoAdapter } from "../../../adapters/crypto/CryptoAdapter";
import type { SecretVault } from "../../../vault/SecretVault";
import { bytesToBase32 } from "./base32";
import { createOtpAuthUri } from "./otpauthUri";

export type CreateTotpCredentialInput = {
  contactId: ContactId;
  displayName: string;
  direction?: "i_verify_them" | "they_verify_me";
  vault: SecretVault;
  nowIso?: string;
  cryptoAdapter?: CryptoAdapter;
};

export async function createTotpCredential(input: CreateTotpCredentialInput): Promise<HumanKeyTotpCredential> {
  const secret = input.cryptoAdapter?.randomBytes(20) ?? crypto.getRandomValues(new Uint8Array(20));
  const secretBase32 = bytesToBase32(secret);
  const secretRef = await input.vault.createSecret({
    purpose: "HK_TOTP_1",
    material: secret,
  });

  const now = input.nowIso ?? new Date().toISOString();
  const label = `${input.displayName} via Abracadoo`;
  const otpauthUri = createOtpAuthUri({
    issuer: "Abracadoo",
    accountName: label,
    secretBase32,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  return {
    id: (input.cryptoAdapter?.randomId() ?? crypto.randomUUID()) as CredentialId,
    contactId: input.contactId,
    profile: "HK_TOTP_1",
    direction: input.direction ?? "i_verify_them",
    label,
    secretRef,
    publicMaterial: {
      otpauthUri,
      qrLabel: label,
    },
    parameters: {
      issuer: "Abracadoo",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      encoding: "base32",
    },
    lifecycle: {
      createdAt: now,
    },
  };
}
