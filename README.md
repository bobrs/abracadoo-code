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
- Transports such as Nostr, server messaging, and manual QR/copy-paste remain adapters, not the ontology.

## Architecture pass V0.2

This pass adds the runtime/adapters layer so the same HumanKey domain model can run locally, against a server, through Nostr, or through manual offline exchange.

New boundaries:

- `AbracadooRuntime`
- `StorageAdapter`
- `SecretVault`
- `TransportAdapter`
- `PolicyAdapter`
- `ClockAdapter`
- `CryptoAdapter`

Initial implementations:

- `InMemoryStorageAdapter`
- `InMemorySecretVault`
- `ManualTransportAdapter`
- `LocalPersonalPolicyAdapter`
- `SystemClockAdapter`
- `WebCryptoAdapter`
- `createLocalRuntime()`

Domain services now orchestrate contact, credential, event, policy, vault, and storage updates:

- `createAcquaintanceWithTotp()`
- `recordCredentialShared()`
- `verifyAcquaintanceCode()`
- `revokeCredential()`

## MVP

1. Create Acquaintance.
2. Create `HK_TOTP_1` credential with direction `i_verify_them`.
3. Display an Authenticator-compatible `otpauth://` URI as a QR code.
4. Verify a 6-digit TOTP code locally.
5. Record verification events.
6. Revoke/archive when needed.

## Next implementation target

Convert the scaffold into a runnable Vite + React + TypeScript PWA around the existing services:

- Create Acquaintance screen
- Share QR screen
- Verify code screen
- Contact detail/event timeline
- Local persistence via IndexedDB adapters

## Development notes

This is a seed scaffold, not yet a complete app. The files are arranged so a PWA, server-backed deployment, or community/business fork can grow around the HumanKey domain model without a forklift rewrite.
