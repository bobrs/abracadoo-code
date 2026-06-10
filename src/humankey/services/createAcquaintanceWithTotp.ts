import type { HumanKeyContact, HumanKeyEvent, HumanKeyTotpCredential } from "../model/types";
import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { createHumanKeyContact } from "../contacts/createContact";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";
import { createTotpCredential } from "../profiles/hk-totp-1/createTotpCredential";

export type CreateAcquaintanceWithTotpInput = {
  displayName: string;
  notes?: string;
};

export type CreateAcquaintanceWithTotpResult = {
  contact: HumanKeyContact;
  credential: HumanKeyTotpCredential;
  events: HumanKeyEvent[];
};

export async function createAcquaintanceWithTotp(
  runtime: AbracadooRuntime,
  input: CreateAcquaintanceWithTotpInput
): Promise<CreateAcquaintanceWithTotpResult> {
  const nowIso = runtime.clock.nowIso();
  const contact = createHumanKeyContact(input.displayName, input.notes, {
    nowIso,
    randomId: runtime.crypto.randomId(),
  });

  const policyDecision = await runtime.policy.canCreateCredential(contact);
  if (!policyDecision.allowed) {
    throw new Error(policyDecision.reason ?? "Policy denied credential creation.");
  }

  const credential = await createTotpCredential({
    contactId: contact.id,
    displayName: contact.displayName,
    direction: "i_verify_them",
    vault: runtime.vault,
    nowIso,
    cryptoAdapter: runtime.crypto,
  });

  const contactCreated = createHumanKeyEvent({
    contactId: contact.id,
    type: "contact.created",
    nowIso,
    randomId: runtime.crypto.randomId(),
  });
  const credentialCreated = createHumanKeyEvent({
    contactId: contact.id,
    credentialId: credential.id,
    type: "credential.created",
    data: { profile: credential.profile, direction: credential.direction },
    nowIso,
    randomId: runtime.crypto.randomId(),
  });

  contact.credentialIds.push(credential.id);
  contact.eventIds.push(contactCreated.id, credentialCreated.id);
  contact.state = deriveContactState(contact, [contactCreated, credentialCreated]);
  contact.updatedAt = nowIso;

  await runtime.storage.saveContact(contact);
  await runtime.storage.saveCredential(credential);
  await runtime.storage.appendEvent(contactCreated);
  await runtime.storage.appendEvent(credentialCreated);

  return { contact, credential, events: [contactCreated, credentialCreated] };
}
