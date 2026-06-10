# Architecture Pass V0.4.1: App-Level Vault Placement

V0.4.1 is a small UX/alignment pass. It does not change the HumanKey domain model, backup semantics, or adapter architecture.

## Change

The backup/import controls were moved out of the selected Acquaintance context and into a top-right app-level **Local Vault** card in the hero area.

## Why

HumanKey backup/export applies to the entire local vault, not a single selected Acquaintance. It includes all local Acquaintances, credentials, events, paths, and active TOTP secret material. Presenting it as an app-level Local Vault action prevents users from assuming they are exporting only the selected contact.

## Preserved Invariants

- Acquaintance remains the one-way local verification primitive.
- TOTP verification does not establish a Relationship.
- Backup remains sensitive plaintext JSON until encrypted vault/passphrase wrapping is implemented.
- The selected Acquaintance panel remains focused on the selected contact: QR, setup URI, verification, revocation, facts, and event spine.

## Checks

V0.4.1 passes:

```bash
npm run check
```
