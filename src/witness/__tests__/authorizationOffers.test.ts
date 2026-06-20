import { describe, expect, it } from "vitest";
import {
  buildAcceptPayload,
  deriveConsentPromptHash,
  normalizeAuthorizationOffer,
  sha256Base64Utf8,
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
          consent_prompt_hash: "prompt-hash",
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
      consentPromptHash: "prompt-hash",
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
      app: "abracadoo.app",
      participant_ref: "abracadoo.local.participant/test-ref",
      participant_role: "human_authorizer",
      consent_action: "accept",
      consent_prompt_hash: await sha256Base64Utf8("Accept this witness?"),
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
        consent_prompt_hash: "already-computed",
      },
      "offer-hash"
    );

    expect(await deriveConsentPromptHash(offer)).toBe("already-computed");
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
