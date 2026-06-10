import type { ContactId, CredentialId, EventId, HumanKeyEvent, HumanKeyEventType, PathId } from "../model/types";

export type CreateEventInput = {
  contactId: ContactId;
  credentialId?: CredentialId;
  pathId?: PathId;
  type: HumanKeyEventType;
  data?: Record<string, unknown>;
  nowIso?: string;
  randomId?: string;
};

export function createHumanKeyEvent(input: CreateEventInput): HumanKeyEvent {
  const event: HumanKeyEvent = {
    id: (input.randomId ?? crypto.randomUUID()) as EventId,
    contactId: input.contactId,
    type: input.type,
    createdAt: input.nowIso ?? new Date().toISOString(),
  };

  if (input.credentialId) event.credentialId = input.credentialId;
  if (input.pathId) event.pathId = input.pathId;
  if (input.data) event.data = input.data;

  return event;
}
