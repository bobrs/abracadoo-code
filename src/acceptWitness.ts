import "./styles.css";
import "./acceptWitness.css";
import {
  acceptAuthorizationOffer,
  fetchAuthorizationOffer,
  rejectAuthorizationOffer,
  type AuthorizationOffer,
} from "./witness/authorizationOffers";
import { getOrCreateStableParticipantRef } from "./witness/localParticipantRef";
import { getStoredWitnessReceipt, saveWitnessReceipt, type StoredWitnessReceipt } from "./witness/localWitnessReceiptStore";

function qs<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value?: string): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function offerField(value: string | undefined): string {
  return value && value.trim().length > 0 ? escapeHtml(value) : '<span class="accept-empty">Not provided</span>';
}

function renderStringList(items: string[]): string {
  if (items.length === 0) return '<p class="accept-empty">Not provided</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function safeLinkHref(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return fallback;
  }
  return fallback;
}

function returnHref(offer: AuthorizationOffer, fallback = "/"): string {
  return safeLinkHref(offer.returnUrl, fallback);
}

function summaryRow(label: string, value: string | undefined): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${offerField(value)}</dd></div>`;
}

function renderStoredReceiptBanner(receipt: StoredWitnessReceipt | null): string {
  if (!receipt) return "";
  return `
    <p class="accept-note">
      A local witness receipt for this offer is already stored from ${escapeHtml(formatDate(receipt.storedAt))}.
      Accepting again may create a second server-side event even though Abracadoo already has a local copy.
    </p>
  `;
}

function prettyJson(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function extractReceiptSummary(value: unknown, offer: AuthorizationOffer, participantRef: string): Record<string, string> {
  const summary: Record<string, string> = {
    "Offer ID": offer.offerId,
    "Participant ref": participantRef,
    "Event type": offer.eventType ?? "Not provided",
  };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [summaryLabel, key] of [
      ["Receipt ID", "receipt_id"],
      ["Authorization ID", "authorization_id"],
      ["Event ID", "event_id"],
      ["Witness Event ID", "witness_event_id"],
      ["Accepted at", "accepted_at"],
      ["Witnessed at", "witnessed_at"],
      ["Status", "status"],
    ] as const) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) summary[summaryLabel] = candidate;
    }
  }
  return summary;
}

function renderReceiptSummary(summary: Record<string, string>): string {
  return `<dl class="accept-facts">${Object.entries(summary)
    .map(([label, value]) => summaryRow(label, value))
    .join("")}</dl>`;
}

function renderOffer(offer: AuthorizationOffer, storedReceipt: StoredWitnessReceipt | null): void {
  const root = qs<HTMLElement>("#accept-witness-root");
  root.innerHTML = `
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness acceptance</span>
          </div>
        </div>
        <a class="pill accept-link" href="/">Open main app</a>
      </header>

      <section class="accept-hero panel">
        <div>
          <p class="eyebrow">WitnessKey / LOOPtLOOP</p>
          <h1>Review witness authorization offer</h1>
          <p class="accept-help">Review what is being requested before you explicitly accept or reject this witness loop.</p>
        </div>
        <div class="accept-chip-row">
          <span class="pill">${escapeHtml(offer.eventType ?? "event type pending")}</span>
          <span class="pill">${escapeHtml(offer.offerId)}</span>
        </div>
        <p class="accept-note">This creates a witnessed authorization event. It does not automatically create a Relationship.</p>
        ${renderStoredReceiptBanner(storedReceipt)}
      </section>

      <section class="accept-layout">
        <div class="accept-panel">
          <section class="panel accept-summary">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Offer</p>
                <h2>Offer summary</h2>
              </div>
            </div>
            <dl class="accept-facts">
              ${summaryRow("Issuer name", offer.issuerName)}
              ${summaryRow("Issuer origin", offer.issuerOrigin)}
              ${summaryRow("Event type", offer.eventType)}
              ${summaryRow("Payload hash", offer.payloadHash)}
              ${summaryRow("Payload label", offer.payloadLabel)}
              ${summaryRow("Consent prompt", offer.consentPrompt)}
              ${summaryRow("Expiration time", offer.expiresAt ? formatDate(offer.expiresAt) : undefined)}
            </dl>
          </section>

          <section class="panel accept-list">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Roles</p>
                <h3>Declared roles</h3>
              </div>
            </div>
            ${renderStringList(offer.declaredRoles)}
          </section>

          <section class="panel accept-policy">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Policies</p>
                <h3>Storage policy</h3>
              </div>
            </div>
            ${offer.storagePolicy ? `<p>${escapeHtml(offer.storagePolicy)}</p>` : '<p class="accept-empty">Not provided</p>'}
            <h3>Not-stored policy</h3>
            ${offer.notStoredPolicy ? `<p>${escapeHtml(offer.notStoredPolicy)}</p>` : '<p class="accept-empty">Not provided</p>'}
          </section>

          <section class="panel accept-list">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Claims</p>
                <h3>Claims</h3>
              </div>
            </div>
            ${renderStringList(offer.claims)}
            <h3>Non-claims</h3>
            ${renderStringList(offer.nonClaims)}
          </section>
        </div>

        <aside class="panel accept-sidecard">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Actions</p>
              <h2>Decide locally</h2>
            </div>
          </div>
          <p class="accept-help">Abracadoo will send only acceptance metadata. It will not send any private authorization payload.</p>
          <div class="accept-action-row">
            <button id="accept-offer" type="button">Accept witness loop</button>
            <button id="reject-offer" type="button" class="button-danger">Reject</button>
            <a id="cancel-offer" class="button-secondary accept-link" href="${escapeHtml(returnHref(offer))}">Cancel / leave</a>
          </div>
          <p id="accept-status" class="accept-status" aria-live="polite"></p>
          <div class="accept-meta">
            <span class="pill">${escapeHtml(offer.returnUrl ? "return URL available" : "no return URL")}</span>
            <span class="pill">participant role: human_authorizer</span>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function renderAccepted(offer: AuthorizationOffer, participantRef: string, receipt: unknown): void {
  const root = qs<HTMLElement>("#accept-witness-root");
  const summary = extractReceiptSummary(receipt, offer, participantRef);
  root.innerHTML = `
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness receipt stored</span>
          </div>
        </div>
        <a class="pill accept-link" href="/">Open main app</a>
      </header>

      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Accepted</p>
          <h1>Witness authorization accepted</h1>
          <p class="accept-help">Abracadoo stored the returned receipt locally as a witness artifact.</p>
        </div>
        <p class="accept-note">This creates a witnessed authorization event. It does not automatically create a Relationship.</p>
      </section>

      <section class="accept-layout">
        <div class="accept-panel">
          <section class="panel accept-summary">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Receipt</p>
                <h2>Receipt summary</h2>
              </div>
            </div>
            ${renderReceiptSummary(summary)}
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Raw receipt</p>
                <h2>Returned receipt data</h2>
              </div>
            </div>
            <pre class="accept-json">${prettyJson(receipt)}</pre>
          </section>
        </div>

        <aside class="panel accept-sidecard">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Next</p>
              <h2>Return or leave</h2>
            </div>
          </div>
          <p class="accept-help">The witness receipt is stored locally. No private authorization payload was transmitted by Abracadoo.</p>
          <div class="accept-action-row">
            <a class="accept-link" href="${escapeHtml(returnHref(offer))}">Return to WitnessMark</a>
          </div>
          <a class="accept-footer-link" href="/">Back to Abracadoo</a>
        </aside>
      </section>
    </main>
  `;
}

function renderRejected(offer: AuthorizationOffer): void {
  const root = qs<HTMLElement>("#accept-witness-root");
  root.innerHTML = `
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness offer rejected</span>
          </div>
        </div>
      </header>

      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Rejected</p>
          <h1>Witness authorization rejected</h1>
          <p class="accept-help">No witness receipt was stored locally.</p>
        </div>
        <p class="accept-note">This creates a witnessed authorization event only when accepted. It does not automatically create a Relationship.</p>
        <div class="accept-action-row">
          <a class="accept-link" href="${escapeHtml(returnHref(offer))}">Return to WitnessMark</a>
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `;
}

function renderError(message: string): void {
  const root = qs<HTMLElement>("#accept-witness-root");
  root.innerHTML = `
    <main class="app-shell accept-shell">
      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Witness acceptance</p>
          <h1>Unable to continue</h1>
          <p class="accept-error">${escapeHtml(message)}</p>
        </div>
        <div class="accept-action-row">
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `;
}

function formatActionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setStatus(message: string, isError = false): void {
  const status = qs<HTMLElement>("#accept-status");
  status.textContent = message;
  status.classList.toggle("accept-error", isError);
}

function setBusy(isBusy: boolean): void {
  const acceptButton = qs<HTMLButtonElement>("#accept-offer");
  const rejectButton = qs<HTMLButtonElement>("#reject-offer");
  acceptButton.disabled = isBusy;
  rejectButton.disabled = isBusy;
}

async function bindActions(offer: AuthorizationOffer): Promise<void> {
  const participantRef = getOrCreateStableParticipantRef();

  qs<HTMLButtonElement>("#accept-offer").addEventListener("click", async () => {
    try {
      setBusy(true);
      setStatus("Accepting witness offer...");
      const accepted = await acceptAuthorizationOffer(offer, participantRef);
      await saveWitnessReceipt({
        offer,
        participantRef,
        receipt: accepted.response,
      });
      renderAccepted(offer, participantRef, accepted.response);
    } catch (error) {
      setStatus(`Accept failed. ${formatActionError(error)}`, true);
    } finally {
      if (document.querySelector("#accept-offer")) setBusy(false);
    }
  });

  qs<HTMLButtonElement>("#reject-offer").addEventListener("click", async () => {
    try {
      setBusy(true);
      setStatus("Rejecting witness offer...");
      await rejectAuthorizationOffer(offer.offerId);
      renderRejected(offer);
    } catch (error) {
      setStatus(`Reject failed. ${formatActionError(error)}`, true);
      setBusy(false);
    }
  });
}

async function main(): Promise<void> {
  const offerId = new URLSearchParams(window.location.search).get("offer_id");
  if (!offerId) {
    renderError("Missing offer_id in the query string.");
    return;
  }

  const storedReceipt = await getStoredWitnessReceipt(offerId);
  const offer = await fetchAuthorizationOffer(offerId);
  renderOffer(offer, storedReceipt);
  await bindActions(offer);
}

void main().catch((error) => {
  console.error(error);
  renderError(formatActionError(error));
});
