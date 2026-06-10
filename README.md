# Abracadoo HumanKey Seed

Abracadoo begins with **Acquaintances**: local, one-way HumanKey contacts that let you recognize someone through an Authenticator-compatible TOTP credential.

A **Relationship** is established only after both parties complete a reciprocal app-native loop, such as a successful two-way message exchange.

This scaffold intentionally keeps the MVP small while preserving the future HumanKey attractor:

- Contact is the root object, not TOTP.
- TOTP is the first credential profile: `HK_TOTP_1`.
- One-way verification creates an Acquaintance, not a Relationship.
- Secrets live behind a vault interface.
- Events form the lifecycle spine.
- Lanes exist in the model before messaging exists in the UI.
- Transports such as Nostr should remain adapters, not the ontology.

## MVP

1. Create contact.
2. Create `HK_TOTP_1` credential with direction `i_verify_them`.
3. Display an Authenticator-compatible `otpauth://` URI as a QR code.
4. Verify a 6-digit TOTP code locally.
5. Record verification events.
6. Revoke/archive when needed.

## Development notes

This is a seed scaffold, not yet a complete app. The files are arranged so a Vite + React + TypeScript PWA can grow around the domain model without a forklift rewrite.
