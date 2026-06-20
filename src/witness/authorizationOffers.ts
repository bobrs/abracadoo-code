const TEXT_ENCODER = new TextEncoder();

export const LOOPTLOOP_API_BASE = "https://api.looptloop.online/v0";
export const AUTHORIZATION_ACCEPTANCE_SCHEMA = "WITNESSKEY_AUTHORIZATION_ACCEPTANCE_0_1" as const;

export type AuthorizationOffer = {
  offerId: string;
  issuerName?: string;
  issuerOrigin?: string;
  eventType?: string;
  payloadHash?: string;
  payloadLabel?: string;
  declaredRoles: string[];
  consentPrompt?: string;
  storagePolicy?: string;
  notStoredPolicy?: string;
  claims: string[];
  nonClaims: string[];
  expiresAt?: string;
  returnUrl?: string;
  consentPromptHash?: string;
  raw: Record<string, unknown>;
};

export type AuthorizationOfferAcceptPayload = {
  schema: typeof AUTHORIZATION_ACCEPTANCE_SCHEMA;
  accepted_by: {
    app: "abracadoo.app";
    participant_ref: string;
    participant_role: "human_authorizer";
  };
  consent_action: "accept";
  consent_prompt_hash: string;
};

export type AuthorizationOfferRejectPayload = {
  app: "abracadoo.app";
  consent_action: "reject";
};

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getAtPath(value: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstDefined(value: Record<string, unknown>, paths: readonly (readonly string[])[]): unknown {
  for (const path of paths) {
    const candidate = getAtPath(value, path);
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
}

function readString(value: Record<string, unknown>, paths: readonly (readonly string[])[]): string | undefined {
  const candidate = firstDefined(value, paths);
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : undefined;
}

function formatListEntry(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isRecord(value)) return undefined;

  for (const key of ["label", "text", "claim", "name", "title", "value", "description"] as const) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }

  return JSON.stringify(value);
}

function readStringList(value: Record<string, unknown>, paths: readonly (readonly string[])[]): string[] {
  const candidate = firstDefined(value, paths);
  if (candidate === undefined || candidate === null) return [];
  if (Array.isArray(candidate)) {
    return candidate
      .map((entry) => formatListEntry(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  const single = formatListEntry(candidate);
  return single ? [single] : [];
}

function withOptionalStrings<T extends Record<string, unknown>>(base: T, optional: Record<string, string | undefined>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

function unwrapOfferEnvelope(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};

  for (const key of ["authorization_offer", "offer", "data"] as const) {
    const nested = value[key];
    if (isRecord(nested)) return unwrapOfferEnvelope(nested);
  }

  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSha256Hash(value: string | undefined): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/i.test(value);
}

export async function sha256HexUtf8(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function deriveConsentPromptHash(offer: AuthorizationOffer): Promise<string | undefined> {
  if (isSha256Hash(offer.consentPromptHash)) return offer.consentPromptHash;
  if (!offer.consentPrompt) return undefined;
  return `sha256:${await sha256HexUtf8(offer.consentPrompt)}`;
}

export function normalizeAuthorizationOffer(value: unknown, requestedOfferId: string): AuthorizationOffer {
  const offer = unwrapOfferEnvelope(value);
  const issuer = isRecord(offer.issuer) ? offer.issuer : {};
  const payload = isRecord(offer.payload) ? offer.payload : {};

  return withOptionalStrings<AuthorizationOffer>(
    {
      offerId:
        readString(offer, [["offer_id"], ["id"], ["authorization_offer_id"]]) ??
        requestedOfferId,
      declaredRoles: readStringList(offer, [["declared_roles"], ["roles"], ["participant_roles"]]),
      claims: readStringList(offer, [["claims"], ["claims_to_make"]]),
      nonClaims: readStringList(offer, [["non_claims"], ["nonClaims"], ["claims_not_made"]]),
      raw: offer,
    },
    {
      issuerName: readString(offer, [["issuer_name"]]) ?? readString(issuer, [["name"], ["display_name"]]),
      issuerOrigin: readString(offer, [["issuer_origin"]]) ?? readString(issuer, [["origin"], ["url"]]),
      eventType: readString(offer, [["event_type"], ["authorization_event_type"], ["event", "type"]]),
      payloadHash: readString(offer, [["payload_hash"]]) ?? readString(payload, [["hash"]]),
      payloadLabel: readString(offer, [["payload_label"]]) ?? readString(payload, [["label"]]),
      consentPrompt: readString(offer, [["consent_prompt"], ["consent", "prompt"], ["prompt"]]),
      storagePolicy: readString(offer, [["storage_policy"], ["storage", "policy"], ["storage_policy_text"]]),
      notStoredPolicy: readString(offer, [["not_stored_policy"], ["privacy", "not_stored_policy"], ["notStoredPolicy"]]),
      expiresAt: readString(offer, [["expires_at"], ["expiresAt"], ["expiration_time"]]),
      returnUrl: readString(offer, [["return_url"], ["returnUrl"]]),
      consentPromptHash: readString(offer, [["consent_prompt_hash"], ["consent", "prompt_hash"]]),
    }
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function expectJsonResponse(response: Response, failurePrefix: string): Promise<unknown> {
  const payload = await parseJsonResponse(response);
  if (response.ok) return payload;

  const errorRecord =
    isRecord(payload) && isRecord(payload.error)
      ? payload.error
      : null;
  const errorCode = errorRecord && typeof errorRecord.code === "string" ? errorRecord.code : undefined;
  const errorMessage = errorRecord && typeof errorRecord.message === "string" ? errorRecord.message : undefined;
  const message =
    (errorCode && errorMessage && `${errorCode}: ${errorMessage}`) ||
    errorMessage ||
    errorCode ||
    (isRecord(payload) && typeof payload.error === "string" && payload.error) ||
    (isRecord(payload) && typeof payload.message === "string" && payload.message) ||
    `${failurePrefix} (${response.status})`;
  throw new Error(message);
}

export async function fetchAuthorizationOffer(
  offerId: string,
  options: { apiBase?: string; fetchImpl?: FetchLike } = {}
): Promise<AuthorizationOffer> {
  const apiBase = options.apiBase ?? LOOPTLOOP_API_BASE;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${apiBase}/authorization-offers/${encodeURIComponent(offerId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return normalizeAuthorizationOffer(await expectJsonResponse(response, "Failed to load authorization offer"), offerId);
}

export async function buildAcceptPayload(
  offer: AuthorizationOffer,
  participantRef: string
): Promise<AuthorizationOfferAcceptPayload> {
  const consentPromptHash = await deriveConsentPromptHash(offer);
  if (!consentPromptHash) {
    throw new Error("missing_consent_prompt_hash: Offer did not include a valid consent prompt hash and Abracadoo could not derive one locally.");
  }

  return {
    schema: AUTHORIZATION_ACCEPTANCE_SCHEMA,
    accepted_by: {
      app: "abracadoo.app",
      participant_ref: participantRef,
      participant_role: "human_authorizer",
    },
    consent_action: "accept",
    consent_prompt_hash: consentPromptHash,
  };
}

export async function acceptAuthorizationOffer(
  offer: AuthorizationOffer,
  participantRef: string,
  options: { apiBase?: string; fetchImpl?: FetchLike } = {}
): Promise<{ payload: AuthorizationOfferAcceptPayload; response: unknown }> {
  const apiBase = options.apiBase ?? LOOPTLOOP_API_BASE;
  const fetchImpl = options.fetchImpl ?? fetch;
  const payload = await buildAcceptPayload(offer, participantRef);
  const response = await fetchImpl(`${apiBase}/authorization-offers/${encodeURIComponent(offer.offerId)}/accept`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return {
    payload,
    response: await expectJsonResponse(response, "Failed to accept witness offer"),
  };
}

export async function rejectAuthorizationOffer(
  offerId: string,
  options: { apiBase?: string; fetchImpl?: FetchLike } = {}
): Promise<unknown> {
  const apiBase = options.apiBase ?? LOOPTLOOP_API_BASE;
  const fetchImpl = options.fetchImpl ?? fetch;
  const payload: AuthorizationOfferRejectPayload = {
    app: "abracadoo.app",
    consent_action: "reject",
  };
  const response = await fetchImpl(`${apiBase}/authorization-offers/${encodeURIComponent(offerId)}/reject`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return expectJsonResponse(response, "Failed to reject witness offer");
}
