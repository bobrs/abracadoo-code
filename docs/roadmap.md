# Abracadoo Roadmap

This roadmap keeps the local HumanKey MVP first, inserts an offline-capable shell milestone, and then moves on to fuller Abracadabracadoo messaging.

## Phase 0: Local HumanKey MVP

Phase 0 is the current local-first HumanKey foundation:

- create Acquaintances
- verify with Authenticator-compatible TOTP
- use an encrypted local vault
- export and import encrypted backups
- create and import Path invites
- exchange manual encrypted messages
- witness a Loop
- establish Relationship only after a witnessed reciprocal loop

## Phase 0.5: Offline-Capable PWA Shell

Abracadoo should work as a local-first installed or cached app after first load, assuming browser storage and cache have not been cleared.

The app shell, encrypted local vault access, HumanKey/TOTP verification, QR/text invite creation, and import/export backup should function offline.

### Acceptance Criteria

- add `manifest.webmanifest` with app name, short name, theme/background colors, standalone display mode, scope/start_url, and app icons
- register a service worker from the app entry point
- cache the app shell and required static assets
- provide navigation fallback to `index.html` when offline
- verify no core MVP flow depends on remote CDN assets, remote fonts, analytics scripts, or API calls
- existing encrypted local vault can be opened offline
- Acquaintance creation and HumanKey/TOTP verification work offline
- 140-character sealed-note payload creation works offline
- import/export backup works offline
- add a small online/offline status indicator
- request persistent storage where supported using `navigator.storage.persist()`, while documenting that it is advisory and not guaranteed
- add README notes explaining offline behavior, first-load requirement, browser storage caveats, iOS caveats, and the need for encrypted backups

### Manual Test Checklist

1. Load the app online.
2. Install or cache the app.
3. Turn off the network.
4. Reload or reopen the app.
5. Unlock the vault.
6. View an existing Acquaintance.
7. Generate and verify a TOTP code.
8. Create a QR/text invite.
9. Export an encrypted backup.
10. Confirm offline status is shown.

## Phase 1: Abracadabracadoo Messaging

Phase 1 is the fuller messaging and proof layer that comes after the local MVP and the offline shell are solid.

- fuller messaging flows
- broader proof and transport work
- future carrier-specific and protocol-specific capabilities

QR/image/photo carriers, public/broadcast/listening Paths, and server transport remain outside Phase 0.5.
