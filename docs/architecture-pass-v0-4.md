# Architecture Pass V0.4: Durable Acquaintance Vault

V0.4 turns the working HK_TOTP_1 MVP into a more durable local-first Acquaintance vault.

## Goals

- Preserve the HumanKey ontology: Acquaintance first, Relationship only after a completed reciprocal loop.
- Make local browser state portable through explicit export/import.
- Keep backup semantics at the HumanKey service layer, not inside the UI.
- Add automated tests around the core Acquaintance primitive before expanding into messaging paths.

## Added

### Backup service

`src/humankey/services/backup.ts` adds:

- `exportHumanKeyBackup(runtime)`
- `importHumanKeyBackup(runtime, backup)`
- `HumanKeyBackup` schema version `1`

The backup includes contacts, credentials, paths, events, and secret material required to preserve local verification ability.

Current backups are intentionally labeled:

```text
SENSITIVE_HUMANKEY_BACKUP_CONTAINS_SECRET_MATERIAL
```

Encrypted backups should replace or supplement this plaintext format in the next security pass.

### UI backup controls

The browser UI now includes:

- Export backup
- Import backup
- sensitive plaintext warning copy
- relationship status clarification

### Tests

`vitest` was added with coverage for:

- valid TOTP verification
- invalid TOTP rejection
- revoked credential rejection
- export after revocation
- export/import preserving verification ability

Commands:

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

## Design notes

Backups are implemented as HumanKey service operations, not IndexedDB-specific utilities. This matters because future storage/vault embodiments should still use the same backup semantics.

Import currently restores secret material into the active runtime vault and remaps credential `secretRef` values. Revoked credentials may lack secret material because revocation deletes the local secret.

## Known limitations

- Backup JSON is sensitive plaintext.
- Import currently overwrites matching IDs rather than performing conflict-aware merge.
- No encrypted local vault yet.
- No app-native path exchange yet.
- No QR-based app-native import/export yet.
