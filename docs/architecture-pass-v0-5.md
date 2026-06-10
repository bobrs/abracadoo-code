# Abracadoo HumanKey Seed V0.5 - Encrypted Local Vault

V0.5 adds the first real security hardening pass for the local-first MVP. The app now uses an encrypted IndexedDB-backed SecretVault in the browser runtime. Active TOTP secret material is encrypted with a passphrase-derived AES-GCM key after the local vault is initialized/unlocked.

## What changed

- Added `UnlockableSecretVault` as an extension of the existing `SecretVault` interface.
- Added `EncryptedIndexedDbSecretVault`.
- Existing plaintext IndexedDB secret records are migrated in place after the user unlocks or initializes the encrypted vault.
- Added lock/unlock controls to the app-level Local Vault card.
- Export now produces encrypted passphrase-wrapped HumanKey backup JSON.
- Import supports both V0.4 plaintext backups and V0.5 encrypted backups. Imported active secrets are stored through the encrypted vault.

## Security posture

This is still a browser/PWA vault, not hardware-backed secure storage. The passphrase is held in memory while unlocked. Locking clears the in-memory passphrase and prevents secret reads until unlock.

The HumanKey ontology is unchanged: Acquaintance remains one-way verification; Relationship still requires a completed reciprocal loop.
