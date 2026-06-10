# Architecture Pass V0.3 — Runnable Local PWA Shell

V0.3 turns the HumanKey seed from a pure architecture scaffold into a runnable browser app shell while preserving the V0.2 adapter/runtime boundary.

## Added

- `createBrowserRuntime()` using IndexedDB-backed storage and vault adapters.
- `IndexedDbStorageAdapter` for contacts, credentials, lanes, and events.
- `IndexedDbSecretVault` for local secret material behind `SecretVault`.
- Vanilla TypeScript PWA entrypoint in `src/main.ts`.
- Minimal app UI:
  - create Acquaintance
  - generate HK_TOTP_1 credential
  - render Authenticator-compatible QR via `qrcode`
  - copy otpauth URI
  - mark credential shared
  - verify a 6-digit Authenticator code
  - revoke credential
  - inspect HumanKey event spine
- PWA manifest and simple service worker.

## Preserved invariants

- The root app object remains `HumanKeyContact`, not a TOTP secret.
- A one-way contact is an `acquaintance`, not a `relationship`.
- Relationship status is not reached by TOTP verification alone.
- TOTP remains a profile: `HK_TOTP_1`.
- Secrets remain accessed through `SecretVault` via `secretRef`.
- Local browser persistence is an adapter, not the HumanKey ontology.
- UI calls domain services rather than mutating TOTP objects directly.

## Important limitation

`IndexedDbSecretVault` is intentionally plain local IndexedDB storage for V0.3. It establishes the adapter boundary but does not yet encrypt the local vault. The next security pass should add `EncryptedIndexedDbSecretVault` using a passphrase-derived wrapping key or platform credential when available.

## Next implementation targets

1. Add automated tests for TOTP generation, verification, revocation, and lifecycle state derivation.
2. Add encrypted local vault implementation.
3. Add export/import of HumanKey contacts without raw secret leakage by default.
4. Add explicit manual transport artifacts for QR/copy/paste exchange.
5. Add first `HK_LANE_1` placeholder UI after the Acquaintance MVP is stable.
