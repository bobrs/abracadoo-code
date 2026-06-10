import type { CredentialId, HumanKeyEvent } from "../model/types";
import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { createHumanKeyEvent } from "../events/createEvent";

export async function revokeCredential(runtime: AbracadooRuntime, credentialId: CredentialId): Promise<HumanKeyEvent> {
  const credential = await runtime.storage.getCredential(credentialId);
  if (!credential) throw new Error(`Credential not found: ${credentialId}`);

  const contact = await runtime.storage.getContact(credential.contactId);
  if (!contact) throw new Error(`Contact not found: ${credential.contactId}`);

  const nowIso = runtime.clock.nowIso();
  credential.lifecycle.revokedAt = nowIso;
  await runtime.storage.saveCredential(credential);
  await runtime.vault.deleteSecret(credential.secretRef);

  const event = createHumanKeyEvent({
    contactId: contact.id,
    credentialId: credential.id,
    type: "credential.revoked",
    nowIso,
    randomId: runtime.crypto.randomId(),
  });

  await runtime.storage.appendEvent(event);
  contact.eventIds.push(event.id);
  contact.updatedAt = nowIso;
  await runtime.storage.saveContact(contact);

  return event;
}
