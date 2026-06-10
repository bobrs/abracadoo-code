import type {
  ContactId,
  CredentialId,
  EventId,
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyLoopWitness,
  HumanKeyPath,
  LoopWitnessId,
  PathId,
} from "../../humankey/model/types";
import type { StorageAdapter } from "./StorageAdapter";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly contacts = new Map<ContactId, HumanKeyContact>();
  private readonly credentials = new Map<CredentialId, HumanKeyCredential>();
  private readonly paths = new Map<PathId, HumanKeyPath>();
  private readonly events = new Map<EventId, HumanKeyEvent>();
  private readonly loopWitnesses = new Map<LoopWitnessId, HumanKeyLoopWitness>();

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

  async getPath(id: PathId): Promise<HumanKeyPath | null> {
    const path = this.paths.get(id);
    return path ? clone(path) : null;
  }

  async listPathsForContact(contactId: ContactId): Promise<HumanKeyPath[]> {
    return [...this.paths.values()].filter((path) => path.contactId === contactId).map(clone);
  }

  async savePath(path: HumanKeyPath): Promise<void> {
    this.paths.set(path.id, clone(path));
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

  async getLoopWitness(id: LoopWitnessId): Promise<HumanKeyLoopWitness | null> {
    const loopWitness = this.loopWitnesses.get(id);
    return loopWitness ? clone(loopWitness) : null;
  }

  async listLoopWitnessesForContact(contactId: ContactId): Promise<HumanKeyLoopWitness[]> {
    return [...this.loopWitnesses.values()]
      .filter((loopWitness) => loopWitness.contactId === contactId)
      .sort((first, second) => first.witnessedAt.localeCompare(second.witnessedAt))
      .map(clone);
  }

  async saveLoopWitness(loopWitness: HumanKeyLoopWitness): Promise<void> {
    this.loopWitnesses.set(loopWitness.id, clone(loopWitness));
  }
}
