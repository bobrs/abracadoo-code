# Abracadoo HumanKey Seed

Abracadoo begins with **Acquaintances**: local, one-way HumanKey contacts that let you recognize someone through an Authenticator-compatible TOTP credential.

A **Relationship** is established only after both parties complete a reciprocal app-native loop, such as a successful two-way message exchange.

This scaffold intentionally keeps the MVP small while preserving the future HumanKey attractor:

- Contact is the root object, not TOTP.
- TOTP is the first credential profile: `HK_TOTP_1`.
- One-way verification creates an Acquaintance, not a Relationship.
- Secrets live behind a vault interface.
- Events form the lifecycle spine.
- Paths exist in the model before messaging exists in the UI.
- Transports such as Nostr, server messaging, and manual QR/copy-paste remain adapters, not the ontology.

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

1. Add automated tests for TOTP generation, verification, revocation, and lifecycle state derivation.
2. Add encrypted local vault implementation.
3. Add export/import of HumanKey contacts without raw secret leakage by default.
4. Add explicit manual transport artifacts for QR/copy/paste exchange.
5. Add first `HK_PATH_1` placeholder UI after the Acquaintance MVP is stable.

## V0.5: encrypted local vault

V0.5 replaces the browser runtime's plaintext IndexedDB secret vault with `EncryptedIndexedDbSecretVault`. Users set/unlock a local vault passphrase before creating or verifying HK_TOTP_1 credentials. Active TOTP secret material is encrypted at rest in IndexedDB, and V0.5 exports are encrypted passphrase-wrapped JSON backups. V0.4 plaintext backups can still be imported and are stored through the encrypted vault after import.


## V0.5.1: vault confidence and invited Acquaintance label

V0.5.1 keeps the V0.5 encrypted-vault architecture and adds a small confidence/polish pass:

- clearer vault `new` / `locked` / `unlocked` status styling
- friendlier wrong-passphrase messaging
- encrypted-backup export warning
- encrypted-backup self-check before download
- orange `acquaintance` label for contacts whose credential/path has been shared but never successfully validated

The orange label is a UI cue only; the HumanKey contact state remains `acquaintance`.

## V0.5.2: temporary Cloudflare lockfile hygiene

V0.5.2 removes `package-lock.json` from the scaffold and adds `.npmrc` with `package-lock=false` so Cloudflare Pages does not hang on the current lockfile path.

This is intentionally temporary. Once the repo stabilizes, we should pin Node/npm, regenerate a clean lockfile, and switch CI/Cloudflare to `npm ci`.


## V0.6: path invite model

V0.6 adds the first visible app-native path primitive while preserving the Acquaintance/Relationship distinction.

- `HK_PATH_1` path invite services
- `ABRACADOO_HUMANKEY_PATH_INVITE` public invite artifacts
- inbound/outbound path counts in the selected Acquaintance UI
- `path.created`, `path.shared`, and `path.imported` events

A path is one-way. Path exchange does not establish a Relationship.

## V0.6.1: Path / Loop terminology alignment

V0.6.1 locks in the ecosystem terminology: **Path** replaces **Lane**, and two compatible connected Paths constitute a **Loop**.

- New exports use `ABRACADOO_HUMANKEY_PATH_INVITE`.
- Domain types and services now use `HumanKeyPath`, `PathId`, `createInboundPath()`, `recordPathShared()`, and `importPathInvite()`.
- Legacy V0.6 lane invites/backups/events are still accepted and normalized during import.
- Relationship remains gated on a future witnessed/completed Loop.
