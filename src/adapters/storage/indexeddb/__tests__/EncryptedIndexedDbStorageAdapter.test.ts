import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHumanKeyContact } from "../../../../humankey/contacts/createContact";

type FakeRequest<T> = {
  result: T;
  error: Error | null;
  onsuccess: ((event: { target: FakeRequest<T> }) => void) | null;
  onerror: ((event: { target: FakeRequest<T> }) => void) | null;
  onupgradeneeded: ((event: { target: FakeRequest<T> }) => void) | null;
  transaction: FakeTransaction | null;
};

type FakeIndex = {
  getAll(contactId: string): FakeRequest<unknown[]>;
};

class FakeStore {
  readonly records = new Map<string, unknown>();
  readonly indexNames = {
    contains: (name: string) => name === "contactId" && this.hasContactIndex,
  };

  constructor(
    readonly name: string,
    private hasContactIndex: boolean
  ) {}

  createIndex(name: string): void {
    if (name === "contactId") {
      this.hasContactIndex = true;
    }
  }

  put(record: { id: string }): FakeRequest<undefined> {
    return createRequest(undefined, () => {
      this.records.set(record.id, structuredClone(record));
    });
  }

  get(id: string): FakeRequest<unknown> {
    return createRequest(this.records.has(id) ? structuredClone(this.records.get(id)) : undefined);
  }

  getAll(): FakeRequest<unknown[]> {
    return createRequest([...this.records.values()].map((value) => structuredClone(value)));
  }

  clear(): FakeRequest<undefined> {
    return createRequest(undefined, () => {
      this.records.clear();
    });
  }

  delete(id: string): FakeRequest<undefined> {
    return createRequest(undefined, () => {
      this.records.delete(id);
    });
  }

  index(name: string): FakeIndex {
    if (name !== "contactId" || !this.hasContactIndex) {
      throw new Error(`Missing index: ${name}`);
    }

    return {
      getAll: (contactId: string) =>
        createRequest(
          [...this.records.values()]
            .filter((record) => isIndexedRecord(record) && record.contactId === contactId)
            .map((record) => structuredClone(record))
        ),
    };
  }
}

class FakeTransaction {
  constructor(private readonly database: FakeDatabase) {}

  objectStore(name: string): FakeStore {
    const store = this.database.stores.get(name);
    if (!store) throw new Error(`Missing store: ${name}`);
    return store;
  }
}

class FakeDatabase {
  readonly stores = new Map<string, FakeStore>();

  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string): FakeStore {
    const store = new FakeStore(name, false);
    this.stores.set(name, store);
    return store;
  }

  transaction(name: string): FakeTransaction {
    if (!this.stores.has(name)) {
      throw new Error(`Missing store: ${name}`);
    }
    return new FakeTransaction(this);
  }
}

type FakeOpenRequest = FakeRequest<FakeDatabase> & {
  transaction: FakeTransaction | null;
};

function isIndexedRecord(value: unknown): value is { contactId: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { contactId?: unknown }).contactId === "string");
}

function createRequest<T>(result: T, beforeSuccess?: () => void): FakeRequest<T> {
  const request: FakeRequest<T> = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    transaction: null,
  };

  queueMicrotask(() => {
    try {
      beforeSuccess?.();
      request.onsuccess?.({ target: request });
    } catch (error) {
      request.error = error instanceof Error ? error : new Error(String(error));
      request.onerror?.({ target: request });
    }
  });

  return request;
}

function createIndexedDbFactory() {
  let database: FakeDatabase | undefined;
  let version = 0;

  return {
    get database(): FakeDatabase | undefined {
      return database;
    },
    open(_name: string, requestedVersion: number): FakeOpenRequest {
      const request: FakeOpenRequest = {
        result: database as FakeDatabase,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        transaction: null,
      };

      queueMicrotask(() => {
        const nextDatabase = database ?? new FakeDatabase();
        const needsUpgrade = !database || requestedVersion > version;

        if (needsUpgrade) {
          database = nextDatabase;
          version = requestedVersion;
          request.result = nextDatabase;
          request.transaction = new FakeTransaction(nextDatabase);
          request.onupgradeneeded?.({ target: request });
        }

        database = nextDatabase;
        request.result = nextDatabase;
        request.onsuccess?.({ target: request });
      });

      return request;
    },
  };
}

describe("EncryptedIndexedDbStorageAdapter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps all local app data encrypted in the appState store", async () => {
    const indexedDb = createIndexedDbFactory();
    vi.stubGlobal("indexedDB", indexedDb);

    const { EncryptedIndexedDbStorageAdapter } = await import("../EncryptedIndexedDbStorageAdapter");
    const adapter = new EncryptedIndexedDbStorageAdapter();
    const contact = createHumanKeyContact("Alice");

    await adapter.initialize("test-passphrase-123");
    await adapter.saveContact(contact);

    const storedContact = await adapter.getContact(contact.id);
    expect(storedContact?.displayName).toBe("Alice");

    const database = indexedDb.database;
    expect(database).toBeDefined();
    expect(database?.stores.has("appState")).toBe(true);
    expect(database?.stores.get("contacts")?.records.size ?? 0).toBe(0);

    const appStateStore = database?.stores.get("appState");
    const rawRecord = appStateStore ? [...appStateStore.records.values()][0] : undefined;
    expect(rawRecord).toBeDefined();
    expect(JSON.stringify(rawRecord)).not.toContain("Alice");
    expect(JSON.stringify(rawRecord)).not.toContain(contact.id);

    adapter.lock();
    await expect(adapter.listContacts()).rejects.toThrow(/locked/i);

    await adapter.unlock("test-passphrase-123");
    const unlockedContact = await adapter.getContact(contact.id);
    expect(unlockedContact?.displayName).toBe("Alice");
  });
});
