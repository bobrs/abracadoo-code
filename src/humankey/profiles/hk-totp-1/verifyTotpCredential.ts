import type { HumanKeyTotpCredential } from "../../model/types";
import type { SecretVault } from "../../../vault/SecretVault";
import { verifyTotp } from "./totp";

export type VerifyTotpCredentialInput = {
  credential: HumanKeyTotpCredential;
  code: string;
  vault: SecretVault;
  timestampMs?: number;
};

export async function verifyTotpCredential(input: VerifyTotpCredentialInput): Promise<boolean> {
  if (input.credential.lifecycle.revokedAt) {
    return false;
  }

  const secret = await input.vault.readSecret(input.credential.secretRef);

  return verifyTotp({
    secret,
    code: input.code.trim(),
    ...(input.timestampMs === undefined ? {} : { timestampMs: input.timestampMs }),
    period: input.credential.parameters.period,
    digits: input.credential.parameters.digits,
    window: 1,
  });
}
