import * as QRCode from "qrcode";
import { createBrowserRuntime } from "./runtime/createBrowserRuntime";
import {
  createAcquaintanceWithTotp,
  decryptEncryptedHumanKeyBackup,
  exportEncryptedHumanKeyBackup,
  importHumanKeyBackup,
  isEncryptedHumanKeyBackup,
  recordCredentialShared,
  revokeCredential,
  verifyAcquaintanceCode,
} from "./humankey/services";
import type { HumanKeyContact, HumanKeyEvent, HumanKeyTotpCredential } from "./humankey/model/types";
import { isUnlockableSecretVault } from "./vault/SecretVault";
import "./styles.css";

const runtime = createBrowserRuntime();
let selectedContactId: string | undefined;
let currentQrUri: string | undefined;

function qs<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function setText(selector: string, value: string): void {
  qs<HTMLElement>(selector).textContent = value;
}

function currentDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getSelectedContactBundle(): Promise<{
  contact: HumanKeyContact | null;
  credentials: HumanKeyTotpCredential[];
  events: HumanKeyEvent[];
}> {
  if (!selectedContactId) return { contact: null, credentials: [], events: [] };
  const contact = await runtime.storage.getContact(selectedContactId);
  if (!contact) return { contact: null, credentials: [], events: [] };
  const credentials = (await runtime.storage.listCredentialsForContact(contact.id)).filter(
    (credential): credential is HumanKeyTotpCredential => credential.profile === "HK_TOTP_1"
  );
  const events = await runtime.storage.listEventsForContact(contact.id);
  return { contact, credentials, events };
}

async function renderContactList(): Promise<void> {
  const contacts = await runtime.storage.listContacts();
  const list = qs<HTMLDivElement>("#contact-list");
  list.innerHTML = "";

  if (contacts.length === 0) {
    list.innerHTML = `<p class="empty">No acquaintances yet. Create one to generate an Authenticator-compatible HumanKey token.</p>`;
    return;
  }

  contacts
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((contact) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = contact.id === selectedContactId ? "contact-card selected" : "contact-card";
      button.innerHTML = `
        <strong>${escapeHtml(contact.displayName)}</strong>
        <span>${contact.state}</span>
      `;
      button.addEventListener("click", () => {
        selectedContactId = contact.id;
        void render();
      });
      list.appendChild(button);
    });
}

async function renderSelectedContact(): Promise<void> {
  const panel = qs<HTMLDivElement>("#selected-contact");
  const { contact, credentials, events } = await getSelectedContactBundle();
  currentQrUri = undefined;

  if (!contact) {
    panel.innerHTML = `
      <section class="panel muted-panel">
        <h2>No acquaintance selected</h2>
        <p>Create or select an acquaintance to share a HumanKey token and verify codes.</p>
      </section>
    `;
    return;
  }

  const credential = credentials[0];
  const isRevoked = credential?.lifecycle.revokedAt !== undefined;
  const otpauthUri = credential?.publicMaterial?.otpauthUri;
  currentQrUri = otpauthUri;

  panel.innerHTML = `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${contact.state}</p>
          <h2>${escapeHtml(contact.displayName)}</h2>
        </div>
        <span class="pill">${credential?.profile ?? "no credential"}</span>
      </div>

      <div class="grid two">
        <div>
          <h3>Authenticator token</h3>
          <p class="help">This one-way credential lets you verify that the holder has the token you created. It does not create a relationship by itself.</p>
          <canvas id="qr-canvas" width="240" height="240" aria-label="Authenticator QR code"></canvas>
          <textarea id="otpauth-uri" readonly>${escapeHtml(otpauthUri ?? "")}</textarea>
          <div class="button-row">
            <button id="copy-uri" type="button" ${otpauthUri ? "" : "disabled"}>Copy URI</button>
            <button id="mark-shared" type="button" ${credential && !isRevoked ? "" : "disabled"}>Mark shared</button>
            <button id="revoke-credential" type="button" ${credential && !isRevoked ? "" : "disabled"}>Revoke</button>
          </div>
        </div>

        <div>
          <h3>Verify by phone or desk call</h3>
          <p class="help">Ask the acquaintance for the current code from their Authenticator app.</p>
          <form id="verify-form" class="stack">
            <label>
              6-digit code
              <input id="verify-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" ${credential && !isRevoked ? "" : "disabled"} />
            </label>
            <button type="submit" ${credential && !isRevoked ? "" : "disabled"}>Verify code</button>
          </form>
          <dl class="facts">
            <div><dt>Created</dt><dd>${formatDate(contact.createdAt)}</dd></div>
            <div><dt>Last verified</dt><dd>${formatDate(credential?.lifecycle.lastVerifiedAt)}</dd></div>
            <div><dt>Revoked</dt><dd>${formatDate(credential?.lifecycle.revokedAt)}</dd></div>
            <div><dt>Relationship</dt><dd>${contact.state === "relationship" ? "Established" : "Not established"}</dd></div>
          </dl>
          <p class="help status-note">Authentication proves possession. Messaging proves a living channel. Relationship requires a completed loop.</p>
        </div>
      </div>

      <h3>HumanKey event spine</h3>
      <ol class="events">
        ${events
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((event) => `<li><strong>${event.type}</strong><span>${formatDate(event.createdAt)}</span></li>`)
          .join("")}
      </ol>
    </section>
  `;

  if (otpauthUri) {
    const canvas = qs<HTMLCanvasElement>("#qr-canvas");
    await QRCode.toCanvas(canvas, otpauthUri, { width: 240, margin: 2, errorCorrectionLevel: "M" });
  }

  bindSelectedContactActions(contact, credential);
}

function bindSelectedContactActions(contact: HumanKeyContact, credential?: HumanKeyTotpCredential): void {
  qs<HTMLButtonElement>("#copy-uri").addEventListener("click", async () => {
    if (!currentQrUri) return;
    await navigator.clipboard.writeText(currentQrUri);
    showNotice("Authenticator URI copied.");
  });

  qs<HTMLButtonElement>("#mark-shared").addEventListener("click", async () => {
    if (!credential) return;
    await recordCredentialShared(runtime, credential.id);
    showNotice("Credential marked as shared.");
    await render();
  });

  qs<HTMLButtonElement>("#revoke-credential").addEventListener("click", async () => {
    if (!credential) return;
    await revokeCredential(runtime, credential.id);
    showNotice("Credential revoked.");
    await render();
  });

  qs<HTMLFormElement>("#verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!credential) return;
    try {
      await ensureVaultUnlocked();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
      return;
    }
    const code = qs<HTMLInputElement>("#verify-code").value.trim();
    const result = await verifyAcquaintanceCode(runtime, {
      contactId: contact.id,
      credentialId: credential.id,
      code,
    });
    showNotice(result.valid ? "Valid HumanKey code." : "Invalid code.");
    await render();
  });
}



async function refreshVaultStatus(): Promise<void> {
  const status = qs<HTMLElement>("#vault-status");
  if (!isUnlockableSecretVault(runtime.vault)) {
    status.textContent = "open";
    return;
  }

  const hasVault = await runtime.vault.hasVault();
  status.textContent = runtime.vault.isUnlocked() ? "unlocked" : hasVault ? "locked" : "new";
}

function getVaultPassphraseFromUi(): string {
  return qs<HTMLInputElement>("#vault-passphrase").value;
}

async function ensureVaultUnlocked(): Promise<void> {
  if (!isUnlockableSecretVault(runtime.vault)) return;
  if (runtime.vault.isUnlocked()) return;

  const passphrase = getVaultPassphraseFromUi() || prompt("Enter your local vault passphrase") || "";
  if (!passphrase) throw new Error("Vault passphrase is required.");

  if (await runtime.vault.hasVault()) {
    await runtime.vault.unlock(passphrase);
  } else {
    await runtime.vault.initialize(passphrase);
  }
  await refreshVaultStatus();
}

function askBackupPassphrase(action: "export" | "import"): string {
  const message = action === "export"
    ? "Enter a passphrase for this encrypted backup"
    : "Enter the passphrase for this encrypted backup";
  const passphrase = prompt(message) || "";
  if (!passphrase) throw new Error("Backup passphrase is required.");
  if (passphrase.length < 8) throw new Error("Use a backup passphrase of at least 8 characters.");
  return passphrase;
}

async function bindBackupActions(): Promise<void> {
  qs<HTMLButtonElement>("#unlock-vault").addEventListener("click", async () => {
    try {
      await ensureVaultUnlocked();
      qs<HTMLInputElement>("#vault-passphrase").value = "";
      showNotice("Local vault unlocked.");
      await render();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
    }
  });

  qs<HTMLButtonElement>("#lock-vault").addEventListener("click", async () => {
    if (isUnlockableSecretVault(runtime.vault)) runtime.vault.lock();
    qs<HTMLInputElement>("#vault-passphrase").value = "";
    await refreshVaultStatus();
    showNotice("Local vault locked.");
  });

  qs<HTMLButtonElement>("#export-backup").addEventListener("click", async () => {
    try {
      await ensureVaultUnlocked();
      const backupPassphrase = askBackupPassphrase("export");
      const backup = await exportEncryptedHumanKeyBackup(runtime, backupPassphrase);
      const filename = `${currentDateStamp()}__ABRACADOO__BACKUP__HUMANKEY-LOCAL__V0-5__encrypted.json`;
      downloadTextFile(filename, JSON.stringify(backup, null, 2), "application/json");
      showNotice("Encrypted HumanKey backup exported.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
    }
  });

  qs<HTMLButtonElement>("#import-backup-trigger").addEventListener("click", () => {
    qs<HTMLInputElement>("#import-backup-file").click();
  });

  qs<HTMLInputElement>("#import-backup-file").addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      await ensureVaultUnlocked();
      const parsed = JSON.parse(await file.text()) as unknown;
      const backup = isEncryptedHumanKeyBackup(parsed)
        ? await decryptEncryptedHumanKeyBackup(parsed, askBackupPassphrase("import"))
        : parsed;
      const result = await importHumanKeyBackup(runtime, backup);
      selectedContactId = undefined;
      showNotice(
        `Imported ${result.contactsImported} contacts, ${result.credentialsImported} credentials, and ${result.eventsImported} events.`
      );
      await render();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
    } finally {
      input.value = "";
    }
  });
}

async function bindCreateForm(): Promise<void> {
  qs<HTMLFormElement>("#create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayNameInput = qs<HTMLInputElement>("#display-name");
    const notesInput = qs<HTMLTextAreaElement>("#notes");
    const displayName = displayNameInput.value.trim();
    const notes = notesInput.value.trim();
    if (!displayName) return;

    try {
      await ensureVaultUnlocked();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
      return;
    }

    const result = await createAcquaintanceWithTotp(runtime, {
      displayName,
      ...(notes ? { notes } : {}),
    });
    selectedContactId = result.contact.id;
    displayNameInput.value = "";
    notesInput.value = "";
    showNotice("Acquaintance created with HK_TOTP_1 credential.");
    await render();
  });
}

function showNotice(message: string): void {
  const notice = qs<HTMLDivElement>("#notice");
  notice.textContent = message;
  notice.hidden = false;
  window.setTimeout(() => {
    notice.hidden = true;
  }, 3500);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function render(): Promise<void> {
  await renderContactList();
  await renderSelectedContact();
}

async function main(): Promise<void> {
  await bindCreateForm();
  await bindBackupActions();
  await refreshVaultStatus();
  await render();

  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js");
  }
}

void main().catch((error) => {
  console.error(error);
  setText("#fatal-error", error instanceof Error ? error.message : String(error));
});
