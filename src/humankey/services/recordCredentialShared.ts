import type { CredentialId, HumanKeyEvent } from "../model/types";
import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";

export async function recordCredentialShared(
  runtime: AbracadooRuntime,
  credentialId: CredentialId,
  method: "qr" | "copy_paste" | "print" | "verbal" | "other" = "qr"
): Promise<HumanKeyEvent> {
  const credential = await runtime.storage.getCredential(credentialId);
  if (!credential) throw new Error(`Credential not found: ${credentialId}`);

  const contact = await runtime.storage.getContact(credential.contactId);
  if (!contact) throw new Error(`Contact not found: ${credential.contactId}`);

  const nowIso = runtime.clock.nowIso();
  const event = createHumanKeyEvent({
    contactId: contact.id,
    credentialId: credential.id,
    type: "credential.shared",
    data: { method },
    nowIso,
    randomId: runtime.crypto.randomId(),
  });

  await runtime.storage.appendEvent(event);
  const events = await runtime.storage.listEventsForContact(contact.id);
  contact.eventIds.push(event.id);
  contact.state = deriveContactState(contact, events);
  contact.updatedAt = nowIso;
  await runtime.storage.saveContact(contact);

  return event;
}
