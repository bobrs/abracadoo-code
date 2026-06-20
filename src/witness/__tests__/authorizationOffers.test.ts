import { describe, expect, it, vi } from "vitest";
import {
  AUTHORIZATION_ACCEPTANCE_SCHEMA,
  acceptAuthorizationOffer,
  buildAcceptPayload,
  deriveConsentPromptHash,
  normalizeAuthorizationOffer,
  sha256HexUtf8,
} from "../authorizationOffers";
import { createParticipantRef, getOrCreateStableParticipantRef } from "../localParticipantRef";

describe("normalizeAuthorizationOffer", () => {
  it("reads wrapped offer fields used by the accept route", () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer: {
          offer_id: "offer-123",
          issuer: { name: "WitnessMark", origin: "https://witnessmark.example" },
          event_type: "witness.authorization",
          payload_hash: "sha256:abc123",
          payload_label: "Payroll approval",
          declared_roles: ["viewer", "authorizer"],
          consent_prompt: "Allow this witness loop?",
          storage_policy: "Store the signed receipt locally.",
          not_stored_policy: "Do not store the private payload in Abracadoo.",
          claims: ["The issuer requested a witnessed authorization event."],
          non_claims: ["This does not create a relationship."],
          expires_at: "2026-06-19T15:00:00.000Z",
          return_url: "https://witnessmark.example/return",
          consent_prompt_hash: `sha256:${"a".repeat(64)}`,
        },
      },
      "fallback-offer-id"
    );

    expect(offer).toMatchObject({
      offerId: "offer-123",
      issuerName: "WitnessMark",
      issuerOrigin: "https://witnessmark.example",
      eventType: "witness.authorization",
      payloadHash: "sha256:abc123",
      payloadLabel: "Payroll approval",
      declaredRoles: ["viewer", "authorizer"],
      consentPrompt: "Allow this witness loop?",
      storagePolicy: "Store the signed receipt locally.",
      notStoredPolicy: "Do not store the private payload in Abracadoo.",
      claims: ["The issuer requested a witnessed authorization event."],
      nonClaims: ["This does not create a relationship."],
      expiresAt: "2026-06-19T15:00:00.000Z",
      returnUrl: "https://witnessmark.example/return",
      consentPromptHash: `sha256:${"a".repeat(64)}`,
    });
  });

  it("falls back to alternate field names and stringifies object claims", () => {
    const offer = normalizeAuthorizationOffer(
      {
        authorization_offer: {
          id: "offer-456",
          issuer_name: "Issuer B",
          issuer_origin: "https://issuer-b.example",
          event: { type: "authorization.grant" },
          payload: { hash: "hash-456", label: "Label B" },
          roles: "human_authorizer",
          prompt: "Confirm",
          privacy: { not_stored_policy: "Never store the private payload." },
          claims: [{ text: "A claim" }, { other: true }],
          nonClaims: "No account creation",
        },
      },
      "fallback-offer-id"
    );

    expect(offer.offerId).toBe("offer-456");
    expect(offer.declaredRoles).toEqual(["human_authorizer"]);
    expect(offer.claims).toEqual(["A claim", '{"other":true}']);
    expect(offer.nonClaims).toEqual(["No account creation"]);
  });
});

describe("buildAcceptPayload", () => {
  it("sends only acceptance metadata and excludes any private payload fields", async () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer_id: "offer-private",
        consent_prompt: "Accept this witness?",
        payload_hash: "sha256:private",
        authorization_payload: {
          secret: "do-not-send",
        },
      },
      "offer-private"
    );

    const payload = await buildAcceptPayload(offer, "abracadoo.local.participant/test-ref");

    expect(payload).toEqual({
      schema: AUTHORIZATION_ACCEPTANCE_SCHEMA,
      accepted_by: {
        app: "abracadoo.app",
        participant_ref: "abracadoo.local.participant/test-ref",
        participant_role: "human_authorizer",
      },
      consent_action: "accept",
      consent_prompt_hash: `sha256:${await sha256HexUtf8("Accept this witness?")}`,
    });
    expect("authorization_payload" in payload).toBe(false);
    expect("payload" in payload).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("do-not-send");
  });

  it("reuses the offer hash when present", async () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer_id: "offer-hash",
        consent_prompt: "Prompt",
        consent_prompt_hash: `sha256:${"b".repeat(64)}`,
      },
      "offer-hash"
    );

    expect(await deriveConsentPromptHash(offer)).toBe(`sha256:${"b".repeat(64)}`);
  });

  it("recomputes the hash when the offer hash is not a sha256: value", async () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer_id: "offer-recompute",
        consent_prompt: "Prompt",
        consent_prompt_hash: "already-computed",
      },
      "offer-recompute"
    );

    expect(await deriveConsentPromptHash(offer)).toBe(`sha256:${await sha256HexUtf8("Prompt")}`);
  });

  it("posts the exact acceptance schema and body required by LOOPtLOOP", async () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer_id: "offer-post",
        consent_prompt: "Accept this witness?",
        authorization_payload: {
          secret: "do-not-send",
        },
      },
      "offer-post"
    );
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ status: "accepted" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const accepted = await acceptAuthorizationOffer(offer, "abracadoo.local.participant/test-ref", { fetchImpl });
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    const acceptedBy = body.accepted_by as Record<string, unknown>;

    expect(accepted.payload.schema).toBe(AUTHORIZATION_ACCEPTANCE_SCHEMA);
    expect(body.schema).toBe(AUTHORIZATION_ACCEPTANCE_SCHEMA);
    expect(acceptedBy.app).toBe("abracadoo.app");
    expect(acceptedBy.participant_ref).toBe("abracadoo.local.participant/test-ref");
    expect(acceptedBy.participant_role).toBe("human_authorizer");
    expect(body.consent_action).toBe("accept");
    expect(typeof body.consent_prompt_hash).toBe("string");
    expect(String(body.consent_prompt_hash)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("do-not-send");
  });

  it("surfaces API error code and message for the accept page", async () => {
    const offer = normalizeAuthorizationOffer(
      {
        offer_id: "offer-error",
        consent_prompt_hash: `sha256:${"c".repeat(64)}`,
      },
      "offer-error"
    );
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "invalid_schema",
            message: 'schema must be "WITNESSKEY_AUTHORIZATION_ACCEPTANCE_0_1".',
          },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await expect(acceptAuthorizationOffer(offer, "abracadoo.local.participant/test-ref", { fetchImpl })).rejects.toThrow(
      'invalid_schema: schema must be "WITNESSKEY_AUTHORIZATION_ACCEPTANCE_0_1".'
    );
  });
});

describe("local participant ref", () => {
  it("creates a stable pseudonymous ref once and reuses it", () => {
    const storage = new Map<string, string>();
    const storageLike = {
      getItem(key: string): string | null {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string): void {
        storage.set(key, value);
      },
    };

    const first = getOrCreateStableParticipantRef(storageLike, () => "abc-123");
    const second = getOrCreateStableParticipantRef(storageLike, () => "different");

    expect(first).toBe("abracadoo.local.participant/abc-123");
    expect(second).toBe(first);
    expect(createParticipantRef("manual")).toBe("abracadoo.local.participant/manual");
  });
});
