import type {
  ContactId,
  CredentialId,
  EventId,
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyPath,
  PathId,
} from "../../../humankey/model/types";
import type { StorageAdapter } from "../StorageAdapter";
import { getAllByContactId, getAllRecords, getRecord, putRecord } from "./idb";

function normalizeContact(contact: HumanKeyContact | null): HumanKeyContact | null {
  if (!contact) return null;
  return { ...contact, pathIds: contact.pathIds ?? contact.laneIds ?? [] };
}

function normalizePath(path: HumanKeyPath | null): HumanKeyPath | null {
  if (!path) return null;
  return { ...path, profile: "HK_PATH_1" };
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  async getContact(id: ContactId): Promise<HumanKeyContact | null> {
    return normalizeContact(await getRecord<HumanKeyContact>("contacts", id));
  }

  async listContacts(): Promise<HumanKeyContact[]> {
    return (await getAllRecords<HumanKeyContact>("contacts")).map((contact) => normalizeContact(contact)!);
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

  async getPath(id: PathId): Promise<HumanKeyPath | null> {
    return normalizePath((await getRecord<HumanKeyPath>("paths", id)) ?? (await getRecord<HumanKeyPath>("lanes", id)));
  }

  async listPathsForContact(contactId: ContactId): Promise<HumanKeyPath[]> {
    const [paths, legacyLanes] = await Promise.all([
      getAllByContactId<HumanKeyPath>("paths", contactId),
      getAllByContactId<HumanKeyPath>("lanes", contactId),
    ]);
    return [...paths, ...legacyLanes].map((path) => normalizePath(path)!);
  }

  savePath(path: HumanKeyPath): Promise<void> {
    return putRecord("paths", path);
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
