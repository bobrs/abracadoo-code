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
} from "../../../humankey/model/types";
import type { StorageAdapter } from "../StorageAdapter";
import { clearStore, getAllRecords, getRecord, putRecord } from "./idb";
import type { EncryptedPayload } from "../../../vault/crypto/passphraseCrypto";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase } from "../../../vault/crypto/passphraseCrypto";

const APP_STATE_ID = "__abracadoo_encrypted_app_state__";
const APP_STATE_CHECK_TEXT = "abracadoo-app-state-v1";
const LEGACY_STORE_NAMES = ["contacts", "credentials", "paths", "lanes", "events", "loopWitnesses", "witnessReceipts"] as const;

type AppState = {
  contacts: HumanKeyContact[];
  credentials: HumanKeyCredential[];
  paths: HumanKeyPath[];
  events: HumanKeyEvent[];
  loopWitnesses: HumanKeyLoopWitness[];
};

type AppStateRecord = {
  id: typeof APP_STATE_ID;
  type: "encrypted_app_state";
  createdAt: string;
  check: EncryptedPayload;
  state: EncryptedPayload;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyState(): AppState {
  return {
    contacts: [],
    credentials: [],
    paths: [],
    events: [],
    loopWitnesses: [],
  };
}

function normalizeContact(contact: HumanKeyContact): HumanKeyContact {
  return {
    ...contact,
    pathIds: contact.pathIds ?? contact.laneIds ?? [],
  };
}

function normalizePath(path: HumanKeyPath): HumanKeyPath {
  return {
    ...path,
    profile: "HK_PATH_1",
  };
}

function normalizeLegacyState(state: AppState): AppState {
  return {
    contacts: state.contacts.map(normalizeContact),
    credentials: state.credentials.map(clone),
    paths: state.paths.map(normalizePath),
    events: state.events.map(clone),
    loopWitnesses: state.loopWitnesses.map(clone),
  };
}

async function loadLegacyState(): Promise<AppState> {
  const [contacts, credentials, pathRecords, legacyLanes, events, loopWitnesses] = await Promise.all([
    getAllRecords<HumanKeyContact>("contacts"),
    getAllRecords<HumanKeyCredential>("credentials"),
    getAllRecords<HumanKeyPath>("paths"),
    getAllRecords<HumanKeyPath>("lanes"),
    getAllRecords<HumanKeyEvent>("events"),
    getAllRecords<HumanKeyLoopWitness>("loopWitnesses"),
  ]);

  return normalizeLegacyState({
    contacts,
    credentials,
    paths: [...pathRecords, ...legacyLanes],
    events,
    loopWitnesses,
  });
}

async function clearLegacyStores(): Promise<void> {
  await Promise.all(LEGACY_STORE_NAMES.map((storeName) => clearStore(storeName)));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...items, clone(item)];
  const next = items.slice();
  next[index] = clone(item);
  return next;
}

function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export class EncryptedIndexedDbStorageAdapter implements StorageAdapter {
  private passphrase: string | undefined;
  private state: AppState | undefined;

  isUnlocked(): boolean {
    return this.passphrase !== undefined && this.state !== undefined;
  }

  async hasStore(): Promise<boolean> {
    return Boolean(await getRecord<AppStateRecord>("appState", APP_STATE_ID));
  }

  async initialize(passphrase: string): Promise<void> {
    if (await this.hasStore()) {
      await this.unlock(passphrase);
      return;
    }

    const state = await loadLegacyState();
    await this.persistState(state, passphrase, true);
    await clearLegacyStores();
    this.passphrase = passphrase;
    this.state = state;
  }

  async unlock(passphrase: string): Promise<void> {
    const record = await getRecord<AppStateRecord>("appState", APP_STATE_ID);
    if (!record) {
      await this.initialize(passphrase);
      return;
    }

    const check = await decryptJsonWithPassphrase<string>(record.check, passphrase);
    if (check !== APP_STATE_CHECK_TEXT) {
      throw new Error("App storage passphrase did not unlock local data.");
    }

    const state = normalizeLegacyState(await decryptJsonWithPassphrase<AppState>(record.state, passphrase));
    this.passphrase = passphrase;
    this.state = state;
    await this.persistState(state, passphrase, false);
    await clearLegacyStores();
  }

  lock(): void {
    this.passphrase = undefined;
    this.state = undefined;
  }

  async getContact(id: ContactId): Promise<HumanKeyContact | null> {
    const contact = this.requireState().contacts.find((entry) => entry.id === id);
    return contact ? clone(contact) : null;
  }

  async listContacts(): Promise<HumanKeyContact[]> {
    return this.requireState().contacts.map(clone);
  }

  async saveContact(contact: HumanKeyContact): Promise<void> {
    await this.updateState((state) => {
      state.contacts = upsertById(state.contacts, normalizeContact(contact));
    });
  }

  async getCredential(id: CredentialId): Promise<HumanKeyCredential | null> {
    const credential = this.requireState().credentials.find((entry) => entry.id === id);
    return credential ? clone(credential) : null;
  }

  async listCredentialsForContact(contactId: ContactId): Promise<HumanKeyCredential[]> {
    return this.requireState().credentials.filter((credential) => credential.contactId === contactId).map(clone);
  }

  async saveCredential(credential: HumanKeyCredential): Promise<void> {
    await this.updateState((state) => {
      state.credentials = upsertById(state.credentials, clone(credential));
    });
  }

  async getPath(id: PathId): Promise<HumanKeyPath | null> {
    const path = this.requireState().paths.find((entry) => entry.id === id);
    return path ? clone(path) : null;
  }

  async listPathsForContact(contactId: ContactId): Promise<HumanKeyPath[]> {
    return this.requireState().paths.filter((path) => path.contactId === contactId).map(clone);
  }

  async savePath(path: HumanKeyPath): Promise<void> {
    await this.updateState((state) => {
      state.paths = upsertById(state.paths, normalizePath(path));
    });
  }

  async getEvent(id: EventId): Promise<HumanKeyEvent | null> {
    const event = this.requireState().events.find((entry) => entry.id === id);
    return event ? clone(event) : null;
  }

  async listEventsForContact(contactId: ContactId): Promise<HumanKeyEvent[]> {
    return this.requireState().events.filter((event) => event.contactId === contactId).map(clone);
  }

  async appendEvent(event: HumanKeyEvent): Promise<void> {
    await this.updateState((state) => {
      state.events = upsertById(state.events, clone(event));
    });
  }

  async getLoopWitness(id: LoopWitnessId): Promise<HumanKeyLoopWitness | null> {
    const loopWitness = this.requireState().loopWitnesses.find((entry) => entry.id === id);
    return loopWitness ? clone(loopWitness) : null;
  }

  async listLoopWitnessesForContact(contactId: ContactId): Promise<HumanKeyLoopWitness[]> {
    return this.requireState().loopWitnesses.filter((loopWitness) => loopWitness.contactId === contactId).map(clone);
  }

  async saveLoopWitness(loopWitness: HumanKeyLoopWitness): Promise<void> {
    await this.updateState((state) => {
      state.loopWitnesses = upsertById(state.loopWitnesses, clone(loopWitness));
    });
  }

  private requirePassphrase(): string {
    if (!this.passphrase) throw new Error("App storage is locked. Unlock it before using local data.");
    return this.passphrase;
  }

  private requireState(): AppState {
    if (!this.state) throw new Error("App storage is locked. Unlock it before using local data.");
    return this.state;
  }

  private async updateState(mutator: (state: AppState) => void): Promise<void> {
    const passphrase = this.requirePassphrase();
    const state = this.requireState();
    mutator(state);
    await this.persistState(state, passphrase, false);
  }

  private async persistState(state: AppState, passphrase: string, initialize: boolean): Promise<void> {
    const nextState = normalizeLegacyState(state);
    const check = await encryptJsonWithPassphrase(APP_STATE_CHECK_TEXT, passphrase);
    const encryptedState = await encryptJsonWithPassphrase(nextState, passphrase);
    const record: AppStateRecord = {
      id: APP_STATE_ID,
      type: "encrypted_app_state",
      createdAt: new Date().toISOString(),
      check,
      state: encryptedState,
    };
    await putRecord("appState", record);
    this.passphrase = passphrase;
    this.state = nextState;
    if (initialize) {
      return;
    }
  }
}
