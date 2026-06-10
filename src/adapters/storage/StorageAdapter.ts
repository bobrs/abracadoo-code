import type {
  ContactId,
  CredentialId,
  EventId,
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyLane,
  LaneId,
} from "../../humankey/model/types";

export interface StorageAdapter {
  getContact(id: ContactId): Promise<HumanKeyContact | null>;
  listContacts(): Promise<HumanKeyContact[]>;
  saveContact(contact: HumanKeyContact): Promise<void>;

  getCredential(id: CredentialId): Promise<HumanKeyCredential | null>;
  listCredentialsForContact(contactId: ContactId): Promise<HumanKeyCredential[]>;
  saveCredential(credential: HumanKeyCredential): Promise<void>;

  getLane(id: LaneId): Promise<HumanKeyLane | null>;
  listLanesForContact(contactId: ContactId): Promise<HumanKeyLane[]>;
  saveLane(lane: HumanKeyLane): Promise<void>;

  getEvent(id: EventId): Promise<HumanKeyEvent | null>;
  listEventsForContact(contactId: ContactId): Promise<HumanKeyEvent[]>;
  appendEvent(event: HumanKeyEvent): Promise<void>;
}
