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

## Architecture pass V0.4

This pass makes the working local-first Acquaintance MVP more durable and testable.

Added:

- HumanKey backup service: `exportHumanKeyBackup()` / `importHumanKeyBackup()`
- Sensitive plaintext JSON export/import in the browser UI
- Lifecycle copy clarifying that authentication does not establish a Relationship
- `vitest` test suite for verification, revocation, and backup restore behavior
- `docs/architecture-pass-v0-4.md`

New commands:

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

Current backup exports contain TOTP secret material and should be stored like passwords. Encrypted backups are the next security pass.

## Architecture pass V0.3

This pass turns the architecture seed into a runnable browser/PWA shell while preserving the adapter/runtime boundary.

Added:

- `createBrowserRuntime()`
- `IndexedDbStorageAdapter`
- `IndexedDbSecretVault`
- Vite-compatible `index.html`
- Vanilla TypeScript UI in `src/main.ts`
- Authenticator QR rendering with `qrcode`
- PWA manifest and simple service worker
- `docs/architecture-pass-v0-3.md`

The UI calls HumanKey services instead of directly mutating TOTP or IndexedDB records.

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Current MVP flow

1. Create Acquaintance.
2. Create `HK_TOTP_1` credential with direction `i_verify_them`.
3. Display an Authenticator-compatible QR code and `otpauth://` URI.
4. Mark the credential as shared.
5. Ask the acquaintance for their current Authenticator code.
6. Verify the 6-digit TOTP code locally.
7. Record HumanKey lifecycle events.
8. Revoke the credential when needed.

## Important security note

`IndexedDbSecretVault` currently stores secret bytes in local IndexedDB without encryption. This is acceptable for the V0.3 architecture pass because the vault boundary exists, but it is not the desired long-term security posture.

The next security-oriented pass should add an encrypted local vault implementation behind the same `SecretVault` interface.

## Architecture pass V0.2

V0.2 added the runtime/adapters layer so the same HumanKey domain model can run locally, against a server, through Nostr, or through manual offline exchange.

Boundaries:

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

Domain services orchestrate contact, credential, event, policy, vault, and storage updates:

- `createAcquaintanceWithTotp()`
- `recordCredentialShared()`
- `verifyAcquaintanceCode()`
- `revokeCredential()`

## Next implementation targets

1. Add encrypted local vault implementation behind the existing `SecretVault` interface.
2. Add encrypted backup export/import or passphrase-wrapped backup files.
3. Add conflict-aware import behavior for duplicate contacts/credentials.
4. Add explicit manual transport artifacts for QR/copy/paste exchange.
5. Add first `HK_LANE_1` placeholder UI after the Acquaintance vault is stable.
