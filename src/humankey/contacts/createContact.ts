import type { ContactId, HumanKeyContact } from "../model/types";

export type CreateHumanKeyContactOptions = {
  nowIso?: string;
  randomId?: string;
};

export function createHumanKeyContact(
  displayName: string,
  notes?: string,
  options: CreateHumanKeyContactOptions = {}
): HumanKeyContact {
  const now = options.nowIso ?? new Date().toISOString();
  const contact: HumanKeyContact = {
    id: (options.randomId ?? crypto.randomUUID()) as ContactId,
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
