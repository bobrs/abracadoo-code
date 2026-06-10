import type {
  ContactId,
  CredentialId,
  EventId,
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyLane,
  LaneId,
} from "../../../humankey/model/types";
import type { StorageAdapter } from "../StorageAdapter";
import { getAllByContactId, getAllRecords, getRecord, putRecord } from "./idb";

export class IndexedDbStorageAdapter implements StorageAdapter {
  getContact(id: ContactId): Promise<HumanKeyContact | null> {
    return getRecord<HumanKeyContact>("contacts", id);
  }

  listContacts(): Promise<HumanKeyContact[]> {
    return getAllRecords<HumanKeyContact>("contacts");
  }

  saveContact(contact: HumanKeyContact): Promise<void> {
    return putRecord("contacts", contact);
  }

  getCredential(id: CredentialId): Promise<HumanKeyCredential | null> {
    return getRecord<HumanKeyCredential>("credentials", id);
  }

  listCredentialsForContact(contactId: ContactId): Promise<HumanKeyCredential[]> {
    return getAllByContactId<HumanKeyCredential>("credentials", contactId);
  }

  saveCredential(credential: HumanKeyCredential): Promise<void> {
    return putRecord("credentials", credential);
  }

  getLane(id: LaneId): Promise<HumanKeyLane | null> {
    return getRecord<HumanKeyLane>("lanes", id);
  }

  listLanesForContact(contactId: ContactId): Promise<HumanKeyLane[]> {
    return getAllByContactId<HumanKeyLane>("lanes", contactId);
  }

  saveLane(lane: HumanKeyLane): Promise<void> {
    return putRecord("lanes", lane);
  }

  getEvent(id: EventId): Promise<HumanKeyEvent | null> {
    return getRecord<HumanKeyEvent>("events", id);
  }

  listEventsForContact(contactId: ContactId): Promise<HumanKeyEvent[]> {
    return getAllByContactId<HumanKeyEvent>("events", contactId);
  }

  appendEvent(event: HumanKeyEvent): Promise<void> {
    return putRecord("events", event);
  }
}
