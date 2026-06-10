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
import type { StorageAdapter } from "./StorageAdapter";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly contacts = new Map<ContactId, HumanKeyContact>();
  private readonly credentials = new Map<CredentialId, HumanKeyCredential>();
  private readonly lanes = new Map<LaneId, HumanKeyLane>();
  private readonly events = new Map<EventId, HumanKeyEvent>();

  async getContact(id: ContactId): Promise<HumanKeyContact | null> {
    const contact = this.contacts.get(id);
    return contact ? clone(contact) : null;
  }

  async listContacts(): Promise<HumanKeyContact[]> {
    return [...this.contacts.values()].map(clone);
  }

  async saveContact(contact: HumanKeyContact): Promise<void> {
    this.contacts.set(contact.id, clone(contact));
  }

  async getCredential(id: CredentialId): Promise<HumanKeyCredential | null> {
    const credential = this.credentials.get(id);
    return credential ? clone(credential) : null;
  }

  async listCredentialsForContact(contactId: ContactId): Promise<HumanKeyCredential[]> {
    return [...this.credentials.values()].filter((credential) => credential.contactId === contactId).map(clone);
  }

  async saveCredential(credential: HumanKeyCredential): Promise<void> {
    this.credentials.set(credential.id, clone(credential));
  }

  async getLane(id: LaneId): Promise<HumanKeyLane | null> {
    const lane = this.lanes.get(id);
    return lane ? clone(lane) : null;
  }

  async listLanesForContact(contactId: ContactId): Promise<HumanKeyLane[]> {
    return [...this.lanes.values()].filter((lane) => lane.contactId === contactId).map(clone);
  }

  async saveLane(lane: HumanKeyLane): Promise<void> {
    this.lanes.set(lane.id, clone(lane));
  }

  async getEvent(id: EventId): Promise<HumanKeyEvent | null> {
    const event = this.events.get(id);
    return event ? clone(event) : null;
  }

  async listEventsForContact(contactId: ContactId): Promise<HumanKeyEvent[]> {
    return [...this.events.values()]
      .filter((event) => event.contactId === contactId)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
      .map(clone);
  }

  async appendEvent(event: HumanKeyEvent): Promise<void> {
    this.events.set(event.id, clone(event));
  }
}
