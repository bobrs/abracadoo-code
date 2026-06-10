import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, type EncryptedPayload } from "../../vault/crypto/passphraseCrypto";
import type {
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyPath,
  SecretRef,
} from "../model/types";

export type HumanKeyBackupSecret = {
  originalRef: SecretRef;
  material: number[];
};

export type HumanKeyBackup = {
  schema: "ABRACADOO_HUMANKEY_BACKUP";
  schemaVersion: 1;
  exportedAt: string;
  warning: "SENSITIVE_HUMANKEY_BACKUP_CONTAINS_SECRET_MATERIAL";
  contacts: HumanKeyContact[];
  credentials: HumanKeyCredential[];
  paths: HumanKeyPath[];
  events: HumanKeyEvent[];
  secrets: HumanKeyBackupSecret[];
};

export type EncryptedHumanKeyBackup = {
  schema: "ABRACADOO_HUMANKEY_ENCRYPTED_BACKUP";
  schemaVersion: 1;
  exportedAt: string;
  warning: "ENCRYPTED_HUMANKEY_BACKUP_REQUIRES_PASSPHRASE";
  encrypted: EncryptedPayload;
};

export type ImportHumanKeyBackupResult = {
  contactsImported: number;
  credentialsImported: number;
  pathsImported: number;
  eventsImported: number;
  secretsImported: number;
};

function normalizeContact(contact: HumanKeyContact): HumanKeyContact {
  const legacy = contact as HumanKeyContact & { laneIds?: string[] };
  return {
    ...contact,
    pathIds: contact.pathIds ?? legacy.laneIds ?? [],
  };
}

function normalizePath(path: HumanKeyPath): HumanKeyPath {
  const legacy = path as HumanKeyPath & { profile?: "HK_PATH_1" | "HK_LANE_1" };
  return {
    ...path,
    profile: "HK_PATH_1",
  };
}

function normalizeEvent(event: HumanKeyEvent): HumanKeyEvent {
  const legacy = event as HumanKeyEvent & { laneId?: string };
  const legacyTypeMap: Record<string, HumanKeyEvent["type"]> = {
    "lane.created": "path.created",
    "lane.shared": "path.shared",
    "lane.imported": "path.imported",
  };
  const normalized: HumanKeyEvent = {
    ...event,
    type: legacyTypeMap[event.type] ?? event.type,
  };
  const pathId = event.pathId ?? legacy.laneId;
  if (pathId) normalized.pathId = pathId;
  return normalized;
}

function assertBackup(value: unknown): asserts value is HumanKeyBackup | (Omit<HumanKeyBackup, "paths"> & { lanes: HumanKeyPath[] }) {
  if (!value || typeof value !== "object") {
    throw new Error("Backup is not an object.");
  }

  const candidate = value as Partial<HumanKeyBackup> & { lanes?: HumanKeyPath[] };
  if (candidate.schema !== "ABRACADOO_HUMANKEY_BACKUP" || candidate.schemaVersion !== 1) {
    throw new Error("Unsupported Abracadoo HumanKey backup schema.");
  }

  for (const field of ["contacts", "credentials", "events", "secrets"] as const) {
    if (!Array.isArray(candidate[field])) {
      throw new Error(`Backup field is missing or invalid: ${field}`);
    }
  }

  if (!Array.isArray(candidate.paths) && !Array.isArray(candidate.lanes)) {
    throw new Error("Backup field is missing or invalid: paths");
  }
}

function normalizeBackup(value: unknown): HumanKeyBackup {
  assertBackup(value);
  const candidate = value as HumanKeyBackup & { lanes?: HumanKeyPath[] };
  const paths = candidate.paths ?? candidate.lanes ?? [];
  return {
    ...candidate,
    contacts: candidate.contacts.map(normalizeContact),
    paths: paths.map(normalizePath),
    events: candidate.events.map(normalizeEvent),
  };
}

function assertEncryptedBackup(value: unknown): asserts value is EncryptedHumanKeyBackup {
  if (!value || typeof value !== "object") {
    throw new Error("Backup is not an object.");
  }
  const candidate = value as Partial<EncryptedHumanKeyBackup>;
  if (candidate.schema !== "ABRACADOO_HUMANKEY_ENCRYPTED_BACKUP" || candidate.schemaVersion !== 1) {
    throw new Error("Unsupported Abracadoo encrypted backup schema.");
  }
  if (!candidate.encrypted || typeof candidate.encrypted !== "object") {
    throw new Error("Encrypted backup payload is missing.");
  }
}

export function isEncryptedHumanKeyBackup(value: unknown): value is EncryptedHumanKeyBackup {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Partial<EncryptedHumanKeyBackup>).schema === "ABRACADOO_HUMANKEY_ENCRYPTED_BACKUP"
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export async function exportHumanKeyBackup(runtime: AbracadooRuntime): Promise<HumanKeyBackup> {
  const contacts = await runtime.storage.listContacts();
  const credentialsNested = await Promise.all(
    contacts.map((contact) => runtime.storage.listCredentialsForContact(contact.id))
  );
  const pathsNested = await Promise.all(contacts.map((contact) => runtime.storage.listPathsForContact(contact.id)));
  const eventsNested = await Promise.all(contacts.map((contact) => runtime.storage.listEventsForContact(contact.id)));

  const credentials = credentialsNested.flat();
  const paths = pathsNested.flat();
  const events = eventsNested.flat();
  const secretRefs = unique([
    ...credentials.map((credential) => credential.secretRef),
    ...paths.map((path) => path.secretRef).filter((ref): ref is string => Boolean(ref)),
  ]);
  const secrets: HumanKeyBackupSecret[] = [];

  for (const secretRef of secretRefs) {
    try {
      const material = await runtime.vault.readSecret(secretRef);
      secrets.push({ originalRef: secretRef, material: Array.from(material) });
    } catch (error) {
      const credentialsUsingSecret = credentials.filter((credential) => credential.secretRef === secretRef);
      const pathsUsingSecret = paths.filter((path) => path.secretRef === secretRef);
      const allCredentialsRevoked = credentialsUsingSecret.every((credential) => credential.lifecycle.revokedAt);
      const allPathsRevoked = pathsUsingSecret.every((path) => path.lifecycle.revokedAt);
      if (!allCredentialsRevoked || !allPathsRevoked) {
        throw error;
      }
    }
  }

  return {
    schema: "ABRACADOO_HUMANKEY_BACKUP",
    schemaVersion: 1,
    exportedAt: runtime.clock.nowIso(),
    warning: "SENSITIVE_HUMANKEY_BACKUP_CONTAINS_SECRET_MATERIAL",
    contacts,
    credentials,
    paths,
    events,
    secrets,
  };
}

export async function exportEncryptedHumanKeyBackup(
  runtime: AbracadooRuntime,
  passphrase: string
): Promise<EncryptedHumanKeyBackup> {
  const backup = await exportHumanKeyBackup(runtime);
  return {
    schema: "ABRACADOO_HUMANKEY_ENCRYPTED_BACKUP",
    schemaVersion: 1,
    exportedAt: runtime.clock.nowIso(),
    warning: "ENCRYPTED_HUMANKEY_BACKUP_REQUIRES_PASSPHRASE",
    encrypted: await encryptJsonWithPassphrase(backup, passphrase),
  };
}

export async function decryptEncryptedHumanKeyBackup(
  input: unknown,
  passphrase: string
): Promise<HumanKeyBackup> {
  assertEncryptedBackup(input);
  const decrypted = await decryptJsonWithPassphrase<unknown>(input.encrypted, passphrase);
  return normalizeBackup(decrypted);
}

export async function importHumanKeyBackup(
  runtime: AbracadooRuntime,
  input: unknown
): Promise<ImportHumanKeyBackupResult> {
  const backup = normalizeBackup(input);

  const secretRefMap = new Map<SecretRef, SecretRef>();

  for (const secret of backup.secrets) {
    const restoredRef = await runtime.vault.createSecret({
      purpose: "HK_TOTP_1",
      material: new Uint8Array(secret.material),
      createdAt: backup.exportedAt,
    });
    secretRefMap.set(secret.originalRef, restoredRef);
  }

  for (const contact of backup.contacts) {
    await runtime.storage.saveContact(contact);
  }

  for (const credential of backup.credentials) {
    const restoredSecretRef = secretRefMap.get(credential.secretRef);
    if (!restoredSecretRef && !credential.lifecycle.revokedAt) {
      throw new Error(`Missing secret material for credential: ${credential.id}`);
    }
    await runtime.storage.saveCredential({ ...credential, secretRef: restoredSecretRef ?? credential.secretRef });
  }

  for (const path of backup.paths) {
    const restoredSecretRef = path.secretRef ? secretRefMap.get(path.secretRef) : undefined;
    if (path.secretRef && !restoredSecretRef && !path.lifecycle.revokedAt) {
      throw new Error(`Missing secret material for path: ${path.id}`);
    }
    const restoredPath = { ...path };
    if (restoredSecretRef) restoredPath.secretRef = restoredSecretRef;
    await runtime.storage.savePath(restoredPath);
  }

  for (const event of backup.events) {
    await runtime.storage.appendEvent(event);
  }

  return {
    contactsImported: backup.contacts.length,
    credentialsImported: backup.credentials.length,
    pathsImported: backup.paths.length,
    eventsImported: backup.events.length,
    secretsImported: backup.secrets.length,
  };
}
