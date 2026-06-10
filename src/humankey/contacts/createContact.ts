import type { ContactId, HumanKeyContact } from "../model/types";

export function createHumanKeyContact(displayName: string, notes?: string): HumanKeyContact {
  const now = new Date().toISOString();
  const contact: HumanKeyContact = {
    id: crypto.randomUUID() as ContactId,
    displayName,
    state: "draft",
    createdAt: now,
    updatedAt: now,
    credentialIds: [],
    laneIds: [],
    eventIds: [],
    metadata: {},
  };

  if (notes) contact.metadata.notes = notes;
  return contact;
}
