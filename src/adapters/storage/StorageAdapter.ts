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

export interface StorageAdapter {
  getContact(id: ContactId): Promise<HumanKeyContact | null>;
  listContacts(): Promise<HumanKeyContact[]>;
  saveContact(contact: HumanKeyContact): Promise<void>;

  getCredential(id: CredentialId): Promise<HumanKeyCredential | null>;
  listCredentialsForContact(contactId: ContactId): Promise<HumanKeyCredential[]>;
  saveCredential(credential: HumanKeyCredential): Promise<void>;

  getPath(id: PathId): Promise<HumanKeyPath | null>;
  listPathsForContact(contactId: ContactId): Promise<HumanKeyPath[]>;
  savePath(path: HumanKeyPath): Promise<void>;

  getEvent(id: EventId): Promise<HumanKeyEvent | null>;
  listEventsForContact(contactId: ContactId): Promise<HumanKeyEvent[]>;
  appendEvent(event: HumanKeyEvent): Promise<void>;

  getLoopWitness(id: LoopWitnessId): Promise<HumanKeyLoopWitness | null>;
  listLoopWitnessesForContact(contactId: ContactId): Promise<HumanKeyLoopWitness[]>;
  saveLoopWitness(loopWitness: HumanKeyLoopWitness): Promise<void>;
}

export interface UnlockableStorageAdapter extends StorageAdapter {
  isUnlocked(): boolean;
  hasStore(): Promise<boolean>;
  initialize(passphrase: string): Promise<void>;
  unlock(passphrase: string): Promise<void>;
  lock(): void;
}

export function isUnlockableStorageAdapter(storage: StorageAdapter): storage is UnlockableStorageAdapter {
  const candidate = storage as Partial<UnlockableStorageAdapter>;
  return (
    typeof candidate.isUnlocked === "function" &&
    typeof candidate.hasStore === "function" &&
    typeof candidate.initialize === "function" &&
    typeof candidate.unlock === "function" &&
    typeof candidate.lock === "function"
  );
}
