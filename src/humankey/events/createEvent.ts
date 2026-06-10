import type { ContactId, CredentialId, EventId, HumanKeyEvent, HumanKeyEventType, LaneId } from "../model/types";

export type CreateEventInput = {
  contactId: ContactId;
  credentialId?: CredentialId;
  laneId?: LaneId;
  type: HumanKeyEventType;
  data?: Record<string, unknown>;
};

export function createHumanKeyEvent(input: CreateEventInput): HumanKeyEvent {
  const event: HumanKeyEvent = {
    id: crypto.randomUUID() as EventId,
    contactId: input.contactId,
    type: input.type,
    createdAt: new Date().toISOString(),
  };

  if (input.credentialId) event.credentialId = input.credentialId;
  if (input.laneId) event.laneId = input.laneId;
  if (input.data) event.data = input.data;

  return event;
}
