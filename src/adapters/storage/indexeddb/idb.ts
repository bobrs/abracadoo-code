const DB_NAME = "abracadoo-humankey";
const DB_VERSION = 1;

export type StoreName = "contacts" | "credentials" | "lanes" | "events" | "secrets";

let openPromise: Promise<IDBDatabase> | undefined;

export function openAbracadooDb(): Promise<IDBDatabase> {
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      for (const storeName of ["contacts", "credentials", "lanes", "events", "secrets"] as StoreName[]) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          if (storeName !== "secrets") {
            store.createIndex("contactId", "contactId", { unique: false });
          }
        }
      }
    };
  });

  return openPromise;
}

export async function txStore(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openAbracadooDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function putRecord<T extends { id: string }>(storeName: StoreName, record: T): Promise<void> {
  const store = await txStore(storeName, "readwrite");
  await requestToPromise(store.put(record));
}

export async function getRecord<T>(storeName: StoreName, id: string): Promise<T | null> {
  const store = await txStore(storeName, "readonly");
  const result = await requestToPromise(store.get(id));
  return (result as T | undefined) ?? null;
}

export async function deleteRecord(storeName: StoreName, id: string): Promise<void> {
  const store = await txStore(storeName, "readwrite");
  await requestToPromise(store.delete(id));
}

export async function getAllRecords<T>(storeName: StoreName): Promise<T[]> {
  const store = await txStore(storeName, "readonly");
  const result = await requestToPromise(store.getAll());
  return result as T[];
}

export async function getAllByContactId<T>(storeName: StoreName, contactId: string): Promise<T[]> {
  const store = await txStore(storeName, "readonly");
  const index = store.index("contactId");
  const result = await requestToPromise(index.getAll(contactId));
  return result as T[];
}
