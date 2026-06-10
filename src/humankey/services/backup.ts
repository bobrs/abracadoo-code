import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, type EncryptedPayload } from "../../vault/crypto/passphraseCrypto";
import type {
  HumanKeyContact,
  HumanKeyCredential,
  HumanKeyEvent,
  HumanKeyLane,
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
  lanes: HumanKeyLane[];
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
  lanesImported: number;
  eventsImported: number;
  secretsImported: number;
};

function assertBackup(value: unknown): asserts value is HumanKeyBackup {
  if (!value || typeof value !== "object") {
    throw new Error("Backup is not an object.");
  }

  const candidate = value as Partial<HumanKeyBackup>;
  if (candidate.schema !== "ABRACADOO_HUMANKEY_BACKUP" || candidate.schemaVersion !== 1) {
    throw new Error("Unsupported Abracadoo HumanKey backup schema.");
  }

  for (const field of ["contacts", "credentials", "lanes", "events", "secrets"] as const) {
    if (!Array.isArray(candidate[field])) {
      throw new Error(`Backup field is missing or invalid: ${field}`);
    }
  }
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
  const lanesNested = await Promise.all(contacts.map((contact) => runtime.storage.listLanesForContact(contact.id)));
  const eventsNested = await Promise.all(contacts.map((contact) => runtime.storage.listEventsForContact(contact.id)));

  const credentials = credentialsNested.flat();
  const lanes = lanesNested.flat();
  const events = eventsNested.flat();
  const secretRefs = unique(credentials.map((credential) => credential.secretRef));
  const secrets: HumanKeyBackupSecret[] = [];

  for (const secretRef of secretRefs) {
    try {
      const material = await runtime.vault.readSecret(secretRef);
      secrets.push({ originalRef: secretRef, material: Array.from(material) });
    } catch (error) {
      const credentialsUsingSecret = credentials.filter((credential) => credential.secretRef === secretRef);
      const allCredentialsRevoked = credentialsUsingSecret.every((credential) => credential.lifecycle.revokedAt);
      if (!allCredentialsRevoked) {
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
    lanes,
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
  assertBackup(decrypted);
  return decrypted;
}

export async function importHumanKeyBackup(
  runtime: AbracadooRuntime,
  input: unknown
): Promise<ImportHumanKeyBackupResult> {
  assertBackup(input);

  const secretRefMap = new Map<SecretRef, SecretRef>();

  for (const secret of input.secrets) {
    const restoredRef = await runtime.vault.createSecret({
      purpose: "HK_TOTP_1",
      material: new Uint8Array(secret.material),
      createdAt: input.exportedAt,
    });
    secretRefMap.set(secret.originalRef, restoredRef);
  }

  for (const contact of input.contacts) {
    await runtime.storage.saveContact(contact);
  }

  for (const credential of input.credentials) {
    const restoredSecretRef = secretRefMap.get(credential.secretRef);
    if (!restoredSecretRef && !credential.lifecycle.revokedAt) {
      throw new Error(`Missing secret material for credential: ${credential.id}`);
    }
    await runtime.storage.saveCredential({ ...credential, secretRef: restoredSecretRef ?? credential.secretRef });
  }

  for (const lane of input.lanes) {
    await runtime.storage.saveLane(lane);
  }

  for (const event of input.events) {
    await runtime.storage.appendEvent(event);
  }

  return {
    contactsImported: input.contacts.length,
    credentialsImported: input.credentials.length,
    lanesImported: input.lanes.length,
    eventsImported: input.events.length,
    secretsImported: input.secrets.length,
  };
}
