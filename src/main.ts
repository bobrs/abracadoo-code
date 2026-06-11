import * as QRCode from "qrcode";
import { createBrowserRuntime } from "./runtime/createBrowserRuntime";
import {
  ArtifactTextError,
  createAcquaintanceWithTotp,
  decryptEncryptedHumanKeyBackup,
  exportEncryptedHumanKeyBackup,
  importHumanKeyBackup,
  importPathInvite,
  createManualMessage,
  importManualMessage,
  isEncryptedHumanKeyBackup,
  ManualMessageError,
  MAX_SEALED_NOTE_CHARS,
  countSealedNoteCharacters,
  parseArtifactText,
  PathInviteError,
  recordCredentialShared,
  recordPathShared,
  createInboundPath,
  revokeCredential,
  stringifyArtifactText,
  verifyAcquaintanceCode,
} from "./humankey/services";
import type { HumanKeyContact, HumanKeyEvent, HumanKeyPath, HumanKeyTotpCredential } from "./humankey/model/types";
import { isUnlockableSecretVault } from "./vault/SecretVault";
import "./styles.css";

const runtime = createBrowserRuntime();
let selectedContactId: string | undefined;
let currentQrUri: string | undefined;
let lastReceivedManualMessage: { contactId: string; plaintext: string; at: string } | undefined;
let lastPathInviteText: { contactId: string; text: string } | undefined;
let lastSealedMessageText: { contactId: string; text: string } | undefined;

type ContactUiStatus = {
  label: string;
  className: string;
};

function activeInboundPaths(paths: HumanKeyPath[]): HumanKeyPath[] {
  return paths.filter((path) => path.direction === "inbound" && !path.lifecycle.revokedAt);
}

function activeOutboundPaths(paths: HumanKeyPath[]): HumanKeyPath[] {
  return paths.filter((path) => path.direction === "outbound" && !path.lifecycle.revokedAt);
}

function sendableOutboundPaths(paths: HumanKeyPath[]): HumanKeyPath[] {
  return activeOutboundPaths(paths).filter(
    (path) => path.transport.kind === "local" && Boolean(path.transport.receivePublicKeyJwk)
  );
}

function openableInboundPaths(paths: HumanKeyPath[]): HumanKeyPath[] {
  return activeInboundPaths(paths).filter((path) => path.transport.kind === "local" && Boolean(path.secretRef));
}

function newestPath(paths: HumanKeyPath[]): HumanKeyPath | undefined {
  return [...paths].sort((a, b) => b.lifecycle.createdAt.localeCompare(a.lifecycle.createdAt))[0];
}

function deriveContactUiStatus(contact: HumanKeyContact, events: HumanKeyEvent[], paths: HumanKeyPath[] = []): ContactUiStatus {
  if (contact.state === "revoked" || contact.state === "archived" || contact.state === "forgotten") {
    const label = contact.state.charAt(0).toUpperCase() + contact.state.slice(1);
    return { label, className: `status-${contact.state}` };
  }

  if (contact.state === "relationship" || events.some((event) => event.type === "relationship.established")) {
    return { label: "Relationship established by witnessed loop", className: "status-relationship" };
  }

  if (contact.state === "loop_witnessed" || events.some((event) => event.type === "loop.completed")) {
    return { label: "Loop witnessed", className: "status-loop-witnessed" };
  }

  const inboundCount = activeInboundPaths(paths).length;
  const outboundCount = activeOutboundPaths(paths).length;
  if (inboundCount > 0 && outboundCount > 0) {
    return { label: "Path connected", className: "status-path-connected" };
  }
  if (inboundCount > 0 || events.some((event) => event.type === "path.shared")) {
    return { label: "Return invited", className: "status-return-invited" };
  }

  if (events.some((event) => event.type === "credential.verified")) {
    return { label: "Verified", className: "status-verified" };
  }

  return { label: "Acquaintance", className: "status-acquaintance" };
}


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

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "acquaintance";
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

function friendlyEventLabel(type: HumanKeyEvent["type"]): string {
  const labels: Record<HumanKeyEvent["type"], string> = {
    "contact.created": "Acquaintance created",
    "contact.state_changed": "Status changed",
    "credential.created": "Acquaintance credential created",
    "credential.shared": "Credential shared",
    "credential.verified": "Credential verified",
    "credential.failed_verification": "Code not verified",
    "credential.revoked": "Credential revoked",
    "path.created": "Path opened",
    "path.shared": "Path invite shared",
    "path.imported": "Return Path imported",
    "lane.created": "Legacy Path opened",
    "lane.shared": "Legacy Path shared",
    "lane.imported": "Legacy Path imported",
    "message.sent": "Sealed message sent",
    "message.received": "Sealed message received",
    "loop.completed": "Loop witnessed",
    "relationship.established": "Relationship established by witnessed loop",
    "consent.confirmed": "Consent confirmed",
    "message.consent_confirmed": "Message consent confirmed",
    "contact.revoked": "Acquaintance revoked",
    "contact.forgotten": "Acquaintance forgotten locally",
    "contact.archived": "Acquaintance archived",
  };
  return labels[type];
}

function eventDataString(event: HumanKeyEvent, key: string): string | undefined {
  const value = event.data?.[key];
  return typeof value === "string" ? value : undefined;
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function friendlyEventDetail(event: HumanKeyEvent): string | undefined {
  const loopWitnessId = eventDataString(event, "loopWitnessId");
  if (loopWitnessId) return `LoopWitness ${shortId(loopWitnessId)}`;

  const sourceInviteId = eventDataString(event, "sourceInviteId");
  if (sourceInviteId) return `Path ${shortId(sourceInviteId)}`;

  const messageId = eventDataString(event, "messageId");
  if (messageId) return `Message ${shortId(messageId)}`;

  if (event.type.startsWith("lane.")) return "Legacy Lane event shown as Path history";
  return undefined;
}

function renderLoopStatus(events: HumanKeyEvent[], contact: HumanKeyContact): string {
  const sentCount = events.filter((event) => event.type === "message.sent").length;
  const receivedCount = events.filter((event) => event.type === "message.received").length;
  const hasLoopCompleted = events.some((event) => event.type === "loop.completed");
  const hasRelationshipEstablished = events.some((event) => event.type === "relationship.established");

  if (hasRelationshipEstablished || contact.state === "relationship") {
    return `
      <div class="loop-status relationship-status">
        <strong>Relationship established by witnessed loop</strong>
        <p>A Loop was witnessed for this Acquaintance. This means reciprocal exchange was observed. It does not mean agreement or consent to message contents.</p>
      </div>
    `;
  }

  if (hasLoopCompleted) {
    return `
      <div class="loop-status loop-complete-status">
        <strong>Loop witnessed</strong>
        <p>A Loop is witnessed when a message travels there and one comes back.</p>
      </div>
    `;
  }

  if (sentCount > 0 || receivedCount > 0) {
    return `
      <div class="loop-status loop-progress-status">
        <strong>Loop in progress</strong>
        <p>A Loop needs one sealed message sent and one sealed message received. Sent: ${sentCount}. Received: ${receivedCount}.</p>
      </div>
    `;
  }

  return `
    <div class="loop-status loop-empty-status">
      <strong>No Loop witnessed yet</strong>
      <p>A Path is one-way. A Loop is witnessed when a message travels there and one comes back.</p>
    </div>
  `;
}

async function getSelectedContactBundle(): Promise<{
  contact: HumanKeyContact | null;
  credentials: HumanKeyTotpCredential[];
  paths: HumanKeyPath[];
  events: HumanKeyEvent[];
}> {
  if (!selectedContactId) return { contact: null, credentials: [], paths: [], events: [] };
  const contact = await runtime.storage.getContact(selectedContactId);
  if (!contact) return { contact: null, credentials: [], paths: [], events: [] };
  const credentials = (await runtime.storage.listCredentialsForContact(contact.id)).filter(
    (credential): credential is HumanKeyTotpCredential => credential.profile === "HK_TOTP_1"
  );
  const paths = await runtime.storage.listPathsForContact(contact.id);
  const events = await runtime.storage.listEventsForContact(contact.id);
  return { contact, credentials, paths, events };
}

function renderPathExchangeStatus(paths: HumanKeyPath[]): string {
  const inboundCount = activeInboundPaths(paths).length;
  const outboundCount = activeOutboundPaths(paths).length;
  let label = "Open a Path";
  let help = "Open an inbound Path, then share the invite so this person can send sealed notes to you.";

  if (inboundCount > 0 && outboundCount > 0) {
    label = "Path connected";
    help = "Both directions exist: one Path lets them send to you, and one Path lets you send to them.";
  } else if (inboundCount > 0) {
    label = "Return invited";
    help = "You have shared or opened a Path. A return Path is an invitation, not a demand.";
  } else if (outboundCount > 0) {
    label = "Return Path imported";
    help = "You can send sealed notes to them. Open your inbound Path when you want them to send back.";
  }

  return `
    <div class="loop-status path-status">
      <strong>${label}</strong>
      <p>${help}</p>
    </div>
  `;
}

async function renderContactList(): Promise<void> {
  const contacts = await runtime.storage.listContacts();
  const list = qs<HTMLDivElement>("#contact-list");
  list.innerHTML = "";

  if (contacts.length === 0) {
    list.innerHTML = `<p class="empty">No acquaintances yet. Create one to generate an Authenticator-compatible HumanKey token.</p>`;
    return;
  }

  const contactsWithEvents = await Promise.all(
    contacts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(async (contact) => ({
        contact,
        events: await runtime.storage.listEventsForContact(contact.id),
        paths: await runtime.storage.listPathsForContact(contact.id),
      }))
  );

  contactsWithEvents.forEach(({ contact, events, paths }) => {
    const status = deriveContactUiStatus(contact, events, paths);
    const button = document.createElement("button");
    button.type = "button";
    button.className = contact.id === selectedContactId ? "contact-card selected" : "contact-card";
    button.innerHTML = `
      <strong>${escapeHtml(contact.displayName)}</strong>
      <span class="contact-state ${status.className}">${escapeHtml(status.label)}</span>
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
  const { contact, credentials, paths, events } = await getSelectedContactBundle();
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
  const contactStatus = deriveContactUiStatus(contact, events, paths);
  const inboundPaths = activeInboundPaths(paths);
  const outboundPaths = activeOutboundPaths(paths);
  const sendablePaths = sendableOutboundPaths(paths);
  const openablePaths = openableInboundPaths(paths);
  const pathInviteText = lastPathInviteText?.contactId === contact.id ? lastPathInviteText.text : "";
  const sealedMessageText = lastSealedMessageText?.contactId === contact.id ? lastSealedMessageText.text : "";
  const sortedEvents = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  panel.innerHTML = `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow contact-state ${contactStatus.className}">${escapeHtml(contactStatus.label)}</p>
          <h2>${escapeHtml(contact.displayName)}</h2>
        </div>
        <span class="pill">${credential?.profile ?? "no credential"}</span>
      </div>

      ${renderLoopStatus(events, contact)}

      <section class="flow-section verify-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Verify</p>
            <h3>Verify</h3>
            <p class="help">Authenticator codes prove possession of this credential. They do not establish a Relationship.</p>
          </div>
          <span class="pill">HK_TOTP_1</span>
        </div>
        <div class="grid two">
        <div>
          <h4>Authenticator token</h4>
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
          <h4>Verify by phone or desk call</h4>
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
          <div><dt>Relationship</dt><dd>${contact.state === "relationship" ? "Established by witnessed loop" : "Not established"}</dd></div>
          </dl>
          <p class="help status-note">Authentication proves possession. Messaging proves a living channel. Relationship requires a completed loop.</p>
        </div>
      </div>
      </section>

      <section class="flow-section path-panel paths-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Paths</p>
            <h3>Paths</h3>
            <p class="help">A Path is one-way. Share your Path invite so this person can send sealed notes to you. Import their Path invite so you can send sealed notes to them.</p>
          </div>
          <span class="pill">HK_PATH_1</span>
        </div>
        ${renderPathExchangeStatus(paths)}
        <div class="grid two">
          <div>
            <h4>Open inbound Path</h4>
            <p class="help">Open an inbound Path locally. Your private receive key stays in your vault. Export or copy the Path invite only when you are ready to share it.</p>
            <div class="button-row">
              <button id="create-inbound-path" type="button">Open inbound Path</button>
              <button id="export-path-invite" type="button" ${inboundPaths.length > 0 ? "" : "disabled"}>Export Path invite</button>
            </div>
            <label>
              Path invite text
              <textarea id="path-invite-output" class="artifact-textarea" readonly placeholder="Open an inbound Path to prepare an invite here, then export or copy it when you are ready to share.">${escapeHtml(pathInviteText)}</textarea>
            </label>
            <div class="button-row">
              <button id="copy-path-invite-text" type="button" ${pathInviteText ? "" : "disabled"}>Copy Path invite</button>
            </div>
          </div>
          <div>
            <h4>Import their Path invite</h4>
            <p class="help">Import their Path invite so you can send sealed notes to them. A return Path is an invitation, not a demand.</p>
            <label>
              Paste their Path invite
              <textarea id="path-invite-paste" class="artifact-textarea" placeholder="Paste Abracadoo Path invite JSON here."></textarea>
            </label>
            <div class="button-row">
              <button id="import-path-invite-text" type="button">Import pasted Path invite</button>
              <button id="import-path-invite-trigger" type="button">Import Path invite file</button>
            </div>
            <input id="import-path-invite-file" type="file" accept="application/json,.json" hidden />
          </div>
        </div>
        <dl class="facts path-facts">
          <div><dt>Inbound Paths</dt><dd>${inboundPaths.length}</dd></div>
          <div><dt>Outbound Paths</dt><dd>${outboundPaths.length}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(deriveContactUiStatus(contact, events, paths).label)}</dd></div>
        </dl>
      </section>

      <section class="flow-section path-panel manual-message-panel messages-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Messages</p>
            <h3>Sealed messages</h3>
            <p class="help">Write a sealed note. Abracadoo seals it for this person’s Path. The Path secures the message, not the carrier. The carrier does not need to understand it.</p>
            <p class="help">Sealed notes are limited to ${MAX_SEALED_NOTE_CHARS} characters for now. Small enough to travel almost anywhere. Enough to say: I’m here. Enough to witness a Loop. Longer messages will come later with fuller Abracadabracadoo messaging.</p>
          </div>
          <span class="pill">HK_MANUAL_MESSAGE_1</span>
        </div>
        <div class="grid two">
          <form id="manual-message-form" class="stack">
            <label>
              Note to seal
              <textarea id="manual-message-text" maxlength="${MAX_SEALED_NOTE_CHARS + 20}" placeholder="Write a short note for this Path..." ${sendablePaths.length > 0 ? "" : "disabled"}></textarea>
            </label>
            <p id="sealed-note-counter" class="help char-counter">${MAX_SEALED_NOTE_CHARS} characters remaining</p>
            <button type="submit" ${sendablePaths.length > 0 ? "" : "disabled"}>Create sealed message</button>
            <p class="help">Send the sealed message by any carrier: text, email, file, chat, or paper copy.</p>
            <label>
              Sealed message text
              <textarea id="sealed-message-output" class="artifact-textarea" readonly placeholder="Create a sealed message to copy it here.">${escapeHtml(sealedMessageText)}</textarea>
            </label>
            <div class="button-row">
              <button id="copy-sealed-message-text" type="button" ${sealedMessageText ? "" : "disabled"}>Copy sealed message</button>
            </div>
          </form>
          <div class="stack">
            <p class="help">Paste or import a sealed message sent to your inbound Path. The Path knows who it is for.</p>
            <label>
              Paste sealed message
              <textarea id="manual-message-paste" class="artifact-textarea" placeholder="Paste Abracadoo sealed message JSON here." ${openablePaths.length > 0 ? "" : "disabled"}></textarea>
            </label>
            <div class="button-row">
              <button id="import-manual-message-text" type="button" ${openablePaths.length > 0 ? "" : "disabled"}>Open pasted sealed message</button>
              <button id="import-manual-message-trigger" type="button" ${openablePaths.length > 0 ? "" : "disabled"}>Import sealed message file</button>
            </div>
            <input id="import-manual-message-file" type="file" accept="application/json,.json" hidden />
            <p class="help">A Loop is witnessed when a message travels there and one comes back.</p>
            ${lastReceivedManualMessage?.contactId === contact.id ? `<div class="message-preview"><strong>Sealed message opened</strong><p>${escapeHtml(lastReceivedManualMessage.plaintext)}</p><small>Shown locally after opening. Not written to the event log. ${formatDate(lastReceivedManualMessage.at)}</small></div>` : ""}
          </div>
        </div>
        <dl class="facts path-facts">
          <div><dt>Messages sent</dt><dd>${events.filter((event) => event.type === "message.sent").length}</dd></div>
          <div><dt>Messages received</dt><dd>${events.filter((event) => event.type === "message.received").length}</dd></div>
          <div><dt>Relationship</dt><dd>${contact.state === "relationship" ? "Established by witnessed loop" : "Requires sent + received sealed messages"}</dd></div>
        </dl>
      </section>

      <section class="flow-section history-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">History</p>
            <h3>HumanKey event spine</h3>
          </div>
        </div>
        <ol class="events">
        ${sortedEvents
          .map(
            (event) => `
              <li>
                <div class="event-label">
                  <strong>${friendlyEventLabel(event.type)}</strong>
                  <small>${event.type}${friendlyEventDetail(event) ? ` · ${escapeHtml(friendlyEventDetail(event)!)} ` : ""}</small>
                </div>
                <span>${formatDate(event.createdAt)}</span>
              </li>
            `
          )
          .join("")}
        </ol>
      </section>
    </section>
  `;

  if (otpauthUri) {
    const canvas = qs<HTMLCanvasElement>("#qr-canvas");
    await QRCode.toCanvas(canvas, otpauthUri, { width: 240, margin: 2, errorCorrectionLevel: "M" });
  }

  bindSelectedContactActions(contact, credential, paths);
}

const PATH_INVITE_SCHEMAS = ["ABRACADOO_HUMANKEY_PATH_INVITE", "ABRACADOO_HUMANKEY_LANE_INVITE"] as const;
const MANUAL_MESSAGE_SCHEMAS = ["ABRACADOO_HUMANKEY_MANUAL_MESSAGE"] as const;

function artifactSchema(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const schema = (value as { schema?: unknown }).schema;
  return typeof schema === "string" ? schema : undefined;
}

async function copyTextToClipboard(text: string, notice: string): Promise<void> {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showNotice(notice);
}

function pathInviteImportNotice(invite: unknown): string {
  return artifactSchema(invite) === "ABRACADOO_HUMANKEY_LANE_INVITE"
    ? "Older Lane invite imported as a Path. Path connected when both directions exist."
    : "Return Path imported. Path connected when both directions exist.";
}

function sealedMessageImportNotice(result: { loopCompleted: boolean; relationshipEstablished: boolean }): string {
  if (result.relationshipEstablished) {
    return "Sealed message opened. A Loop was witnessed; Relationship established by witnessed loop.";
  }
  if (result.loopCompleted) return "Sealed message opened. A Loop was witnessed.";
  return "Sealed message opened.";
}

async function importPathInviteArtifact(contact: HumanKeyContact, invite: unknown): Promise<void> {
  await importPathInvite(runtime, { contactId: contact.id, invite });
  showNotice(pathInviteImportNotice(invite));
  await render();
}

async function importManualMessageArtifact(contact: HumanKeyContact, artifact: unknown): Promise<void> {
  await ensureVaultUnlocked();
  const result = await importManualMessage(runtime, { contactId: contact.id, artifact });
  lastReceivedManualMessage = { contactId: contact.id, plaintext: result.plaintext, at: runtime.clock.nowIso() };
  showNotice(sealedMessageImportNotice(result));
  await render();
}

function bindSelectedContactActions(contact: HumanKeyContact, credential: HumanKeyTotpCredential | undefined, paths: HumanKeyPath[]): void {
  qs<HTMLButtonElement>("#copy-uri").addEventListener("click", async () => {
    if (!currentQrUri) return;
    await copyTextToClipboard(currentQrUri, "Authenticator URI copied.");
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

  qs<HTMLButtonElement>("#create-inbound-path").addEventListener("click", async () => {
    try {
      await ensureVaultUnlocked();
      const result = await createInboundPath(runtime, { contactId: contact.id });
      const inviteText = stringifyArtifactText(result.invite);
      lastPathInviteText = { contactId: contact.id, text: inviteText };
      showNotice("Inbound Path opened. Use Export or Copy Path invite when you are ready to share it.");
      await render();
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    }
  });

  qs<HTMLButtonElement>("#export-path-invite").addEventListener("click", async () => {
    const inboundPath = newestPath(activeInboundPaths(paths));
    if (!inboundPath) return;
    const invite = await recordPathShared(runtime, inboundPath.id);
    const inviteText = stringifyArtifactText(invite);
    lastPathInviteText = { contactId: contact.id, text: inviteText };
    downloadTextFile(
      `${currentDateStamp()}__ABRACADOO__INVITE__HUMANKEY-PATH__V0-8__${safeFilename(contact.displayName)}.json`,
      inviteText,
      "application/json"
    );
    showNotice("Path invite copied into the panel and downloaded. Send this by any carrier.");
    await render();
  });

  qs<HTMLButtonElement>("#copy-path-invite-text").addEventListener("click", async () => {
    await copyTextToClipboard(qs<HTMLTextAreaElement>("#path-invite-output").value, "Path invite copied.");
  });

  qs<HTMLButtonElement>("#import-path-invite-text").addEventListener("click", async () => {
    try {
      const invite = parseArtifactText(qs<HTMLTextAreaElement>("#path-invite-paste").value, {
        artifactName: "Path invite",
        expectedSchemas: PATH_INVITE_SCHEMAS,
      });
      await importPathInviteArtifact(contact, invite);
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    }
  });

  qs<HTMLButtonElement>("#import-path-invite-trigger").addEventListener("click", () => {
    qs<HTMLInputElement>("#import-path-invite-file").click();
  });

  qs<HTMLInputElement>("#import-path-invite-file").addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const invite = parseArtifactText(await file.text(), {
        artifactName: "Path invite",
        expectedSchemas: PATH_INVITE_SCHEMAS,
      });
      await importPathInviteArtifact(contact, invite);
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    } finally {
      input.value = "";
    }
  });

  qs<HTMLFormElement>("#manual-message-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const outboundPath = newestPath(sendableOutboundPaths(paths));
    if (!outboundPath) {
      showNotice("Import their Path invite before sending a sealed message.");
      return;
    }
    const plaintext = qs<HTMLTextAreaElement>("#manual-message-text").value.trim();
    const plaintextChars = countSealedNoteCharacters(plaintext);
    if (plaintextChars > MAX_SEALED_NOTE_CHARS) {
      showNotice(`This sealed note is over ${MAX_SEALED_NOTE_CHARS} characters. Short notes travel better for now.`);
      return;
    }
    if (!plaintext) {
      showNotice("Write a note before sealing it.");
      return;
    }
    try {
      const result = await createManualMessage(runtime, { contactId: contact.id, outboundPathId: outboundPath.id, plaintext });
      const artifactText = stringifyArtifactText(result.artifact);
      lastSealedMessageText = { contactId: contact.id, text: artifactText };
      downloadTextFile(
        `${currentDateStamp()}__ABRACADOO__MESSAGE__HUMANKEY-MANUAL__V0-8__${safeFilename(contact.displayName)}.json`,
        artifactText,
        "application/json"
      );
      showNotice("Sealed message ready. Send this by any carrier.");
      await render();
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    }
  });

  const manualMessageText = qs<HTMLTextAreaElement>("#manual-message-text");
  const sealedNoteCounter = qs<HTMLElement>("#sealed-note-counter");
  const updateSealedNoteCounter = () => {
    const length = countSealedNoteCharacters(manualMessageText.value.trim());
    const remaining = MAX_SEALED_NOTE_CHARS - length;
    sealedNoteCounter.textContent =
      remaining >= 0
        ? `${remaining} characters remaining`
        : `${Math.abs(remaining)} characters over the ${MAX_SEALED_NOTE_CHARS}-character limit`;
    sealedNoteCounter.classList.toggle("over-limit", remaining < 0);
  };
  manualMessageText.addEventListener("input", updateSealedNoteCounter);
  updateSealedNoteCounter();

  qs<HTMLButtonElement>("#copy-sealed-message-text").addEventListener("click", async () => {
    await copyTextToClipboard(qs<HTMLTextAreaElement>("#sealed-message-output").value, "Sealed message copied.");
  });

  qs<HTMLButtonElement>("#import-manual-message-text").addEventListener("click", async () => {
    if (openableInboundPaths(paths).length === 0) {
      showNotice("Open an inbound Path before opening sealed messages.");
      return;
    }
    try {
      const artifact = parseArtifactText(qs<HTMLTextAreaElement>("#manual-message-paste").value, {
        artifactName: "sealed message",
        expectedSchemas: MANUAL_MESSAGE_SCHEMAS,
      });
      await importManualMessageArtifact(contact, artifact);
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    }
  });

  qs<HTMLButtonElement>("#import-manual-message-trigger").addEventListener("click", () => {
    qs<HTMLInputElement>("#import-manual-message-file").click();
  });

  qs<HTMLInputElement>("#import-manual-message-file").addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (openableInboundPaths(paths).length === 0) {
        showNotice("Open an inbound Path before opening sealed messages.");
        return;
      }
      const artifact = parseArtifactText(await file.text(), {
        artifactName: "sealed message",
        expectedSchemas: MANUAL_MESSAGE_SCHEMAS,
      });
      await importManualMessageArtifact(contact, artifact);
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
    } finally {
      input.value = "";
    }
  });

  qs<HTMLFormElement>("#verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!credential) return;
    try {
      await ensureVaultUnlocked();
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
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
    status.className = "pill vault-open";
    status.title = "This runtime does not require a vault unlock.";
    return;
  }

  const hasVault = await runtime.vault.hasVault();
  const state = runtime.vault.isUnlocked() ? "unlocked" : hasVault ? "locked" : "new";
  status.textContent = state;
  status.className = `pill vault-${state}`;
  status.title =
    state === "unlocked"
      ? "Local secret material is available until you lock the vault or close the page."
      : state === "locked"
        ? "Unlock the local vault before creating, verifying, exporting, or importing secret material."
        : "Set up the local encrypted vault before creating an Acquaintance.";
}

async function refreshConnectivityStatus(): Promise<void> {
  const status = qs<HTMLElement>("#connection-status");
  const online = navigator.onLine;
  status.textContent = online ? "online" : "offline";
  status.className = `pill ${online ? "connection-online" : "connection-offline"}`;
  status.title = online
    ? "Network access is available. The app shell can still work offline after first load."
    : "Network access is offline. Cached app shell and local vault features can still work if they were previously loaded.";
}

async function refreshPersistentStorageStatus(): Promise<void> {
  const status = qs<HTMLElement>("#storage-status");
  const storageManager = navigator.storage;
  if (!storageManager || typeof storageManager.persist !== "function") {
    status.textContent = "storage standard";
    status.className = "pill storage-unsupported";
    status.title = "Persistent storage is not supported by this browser.";
    return;
  }

  const persisted = typeof storageManager.persisted === "function" ? await storageManager.persisted() : false;
  if (persisted) {
    status.textContent = "storage persistent";
    status.className = "pill storage-persistent";
    status.title = "The browser has already granted persistent storage for this origin.";
    return;
  }

  const granted = await storageManager.persist();
  status.textContent = granted ? "storage persistent" : "storage standard";
  status.className = granted ? "pill storage-persistent" : "pill storage-standard";
  status.title = granted
    ? "Persistent storage was granted. The browser is less likely to evict this site's data."
    : "Persistent storage was not granted. The app can still work, but browser storage remains best-effort.";
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

function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ArtifactTextError) {
    switch (error.code) {
      case "EMPTY_ARTIFACT_TEXT":
        return "Paste the Abracadoo artifact first.";
      case "INVALID_ARTIFACT_JSON":
        return "That paste was not readable JSON. Try copying only the Abracadoo artifact.";
      case "UNSUPPORTED_ARTIFACT_SCHEMA":
        return "This Abracadoo artifact uses a schema this app does not support yet.";
    }
  }

  if (error instanceof PathInviteError) {
    switch (error.code) {
      case "MALFORMED_PATH_INVITE":
        return "This does not look like an Abracadoo Path invite.";
      case "UNSUPPORTED_PATH_INVITE_SCHEMA":
        return "This Path invite uses a schema this app does not support yet.";
      case "DUPLICATE_PATH_INVITE":
        return "This Path invite is already here.";
    }
  }

  if (error instanceof ManualMessageError) {
    switch (error.code) {
      case "MALFORMED_ARTIFACT":
        return "This does not look like an Abracadoo sealed message.";
      case "WRONG_PATH":
        return "This sealed message was not for this Path.";
      case "WRONG_RECIPIENT":
        return "This sealed message was made for a different Acquaintance. Select the right person and try again.";
      case "VAULT_LOCKED":
        return "Your vault needs to be unlocked before opening this message.";
      case "DECRYPT_FAILED":
        return "This message could not be opened. It may be for a different Path or it may have changed in transit.";
      case "DUPLICATE_MESSAGE":
        return "This sealed message is already here.";
      case "MESSAGE_TOO_LONG":
        return "This sealed note is over 140 characters. Short notes travel better for now.";
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("decrypt") || message.includes("operation failed") || message.includes("did not unlock")) {
    return "That passphrase did not unlock the vault or backup. Try again, and check for typos.";
  }
  return message;
}

function confirmEncryptedBackupExport(): boolean {
  return confirm(
    "Export an encrypted HumanKey backup?\n\n" +
      "Keep the backup file and passphrase safe. Without the passphrase, the backup cannot be restored. Anyone with both can restore your Acquaintance tokens."
  );
}

async function selfCheckEncryptedBackup(backup: unknown, passphrase: string): Promise<void> {
  const decrypted = await decryptEncryptedHumanKeyBackup(backup, passphrase);
  if (!Array.isArray(decrypted.contacts) || !Array.isArray(decrypted.credentials) || !Array.isArray(decrypted.events)) {
    throw new Error("Encrypted backup self-check failed.");
  }
}

async function bindBackupActions(): Promise<void> {
  qs<HTMLButtonElement>("#unlock-vault").addEventListener("click", async () => {
    try {
      await ensureVaultUnlocked();
      qs<HTMLInputElement>("#vault-passphrase").value = "";
      showNotice("Local vault unlocked.");
      await render();
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
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
      if (!confirmEncryptedBackupExport()) return;
      const backupPassphrase = askBackupPassphrase("export");
      const backup = await exportEncryptedHumanKeyBackup(runtime, backupPassphrase);
      await selfCheckEncryptedBackup(backup, backupPassphrase);
      const filename = `${currentDateStamp()}__ABRACADOO__BACKUP__HUMANKEY-LOCAL__V0-7__encrypted.json`;
      downloadTextFile(filename, JSON.stringify(backup, null, 2), "application/json");
      showNotice("Encrypted HumanKey backup exported and self-checked.");
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
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
        `Imported ${result.contactsImported} contacts, ${result.credentialsImported} credentials, ${result.pathsImported} paths, ${result.loopWitnessesImported} loop witnesses, and ${result.eventsImported} events.`
      );
      await render();
    } catch (error) {
      showNotice(friendlyErrorMessage(error));
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
      showNotice(friendlyErrorMessage(error));
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
  await refreshConnectivityStatus();
  await refreshPersistentStorageStatus();
  window.addEventListener("online", () => {
    void refreshConnectivityStatus();
  });
  window.addEventListener("offline", () => {
    void refreshConnectivityStatus();
  });
  await render();

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if ("serviceWorker" in navigator && !isLocalhost) {
    await navigator.serviceWorker.register("/service-worker.js");
  }
}

void main().catch((error) => {
  console.error(error);
  setText("#fatal-error", error instanceof Error ? error.message : String(error));
});
