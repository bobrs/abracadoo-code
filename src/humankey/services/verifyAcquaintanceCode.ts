import type { ContactId, CredentialId, HumanKeyContact, HumanKeyEvent, HumanKeyTotpCredential } from "../model/types";
import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";
import { verifyTotpCredential } from "../profiles/hk-totp-1/verifyTotpCredential";

export type VerifyAcquaintanceCodeInput = {
  contactId: ContactId;
  credentialId: CredentialId;
  code: string;
  timestampMs?: number;
};

export type VerifyAcquaintanceCodeResult = {
  valid: boolean;
  contact: HumanKeyContact;
  credential: HumanKeyTotpCredential;
  event: HumanKeyEvent;
};

function assertTotpCredential(credential: unknown): asserts credential is HumanKeyTotpCredential {
  if (!credential || typeof credential !== "object" || (credential as HumanKeyTotpCredential).profile !== "HK_TOTP_1") {
    throw new Error("Credential is not an HK_TOTP_1 credential.");
  }
}

export async function verifyAcquaintanceCode(
  runtime: AbracadooRuntime,
  input: VerifyAcquaintanceCodeInput
): Promise<VerifyAcquaintanceCodeResult> {
  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error(`Contact not found: ${input.contactId}`);

  const credential = await runtime.storage.getCredential(input.credentialId);
  assertTotpCredential(credential);
  if (credential.contactId !== contact.id) {
    throw new Error("Credential does not belong to contact.");
  }

  const policyDecision = await runtime.policy.canVerifyCredential(contact, credential);
  const valid = policyDecision.allowed
    ? await verifyTotpCredential({
        credential,
        code: input.code,
        vault: runtime.vault,
        ...(input.timestampMs === undefined ? {} : { timestampMs: input.timestampMs }),
      })
    : false;

  const nowIso = runtime.clock.nowIso();
  if (valid) {
    credential.lifecycle.lastVerifiedAt = nowIso;
    await runtime.storage.saveCredential(credential);
  }

  const event = createHumanKeyEvent({
    contactId: contact.id,
    credentialId: credential.id,
    type: valid ? "credential.verified" : "credential.failed_verification",
    data: valid ? { result: "valid" } : { result: "invalid", reason: policyDecision.reason },
    nowIso,
    randomId: runtime.crypto.randomId(),
  });

  await runtime.storage.appendEvent(event);
  const events = await runtime.storage.listEventsForContact(contact.id);
  contact.eventIds.push(event.id);
  contact.state = deriveContactState(contact, events);
  contact.updatedAt = nowIso;
  await runtime.storage.saveContact(contact);

  return { valid, contact, credential, event };
}
