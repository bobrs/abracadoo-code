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

## Current local security note

The browser runtime uses `EncryptedIndexedDbSecretVault`. Active TOTP secrets and inbound Path receive keys are stored behind the `SecretVault` boundary and encrypted at rest after local vault setup/unlock.

Backups are encrypted, passphrase-wrapped JSON by default. Older plaintext backup shapes are still accepted for compatibility and restored through the vault boundary.

Restoring an older encrypted backup may restore keys or records that were later deleted or forgotten locally.

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

## Near implementation targets

1. Refine Acquaintance, Path, Loop, and Relationship management views.
2. Prepare for optional QR display of message packets.
3. Strengthen installable PWA/offline behavior after load.
4. Keep explicit consent confirmation as a later layer, separate from delivery, receipt, Loop witness, and Relationship status.

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

## V0.7 Loop witness / manual message exchange

V0.7 adds the first manual encrypted message exchange profile. Users can export an encrypted manual message over an outbound Path and import/decrypt a message addressed to their inbound Path. Once the local app has witnessed both a sent and received message for a contact, it records `loop.completed` and `relationship.established`.

This preserves the ontology: a Path is one-way, a Loop is two connected Paths, and a Relationship is a witnessed Loop. Manual message artifacts can move over any human-mediated transport; the transport does not define the HumanKey object model.

## V0.7.1: Loop witness confidence

V0.7.1 keeps the V0.7 architecture and makes the first Loop clearer and less surprising:

- importing a Path invite no longer creates unused receive-key secret material
- backup import restores inbound Path receive keys with the `HK_PATH_1_RECEIVE_KEY` purpose
- sent-only and received-only manual exchanges do not establish a Relationship
- repeated witness checks do not duplicate `loop.completed` or `relationship.established`
- manual message import has friendly errors for malformed artifacts, wrong Paths, wrong Acquaintances, locked vaults, and failed decrypts
- the UI shows friendly event labels and a selected-Acquaintance Loop / Relationship status area

V0.7.1 used coarse contact-level witness language. V0.7.2 supersedes that with local path-pair `LoopWitness` records while preserving the same user-visible Relationship threshold.

## V0.7.2: Witness & forgetting alignment

V0.7.2 adds local `ABRACADOO_LOOP_WITNESS` records. A `loop.completed` event now references the local `loopWitnessId`, and new `relationship.established` events identify the basis as `witnessed_manual_loop`.

Relationship remains an Abracadoo.app witnessed-loop state. It means reciprocal manual exchange was observed. It does not mean agreement, legal consent, durable identity, public trust, emotional closeness, or consent to message contents.

Explicit consent confirmation is reserved for a later layer through event names such as `consent.confirmed` and `message.consent_confirmed`; it is not required for the current app-profile Relationship state.

Manual messages remain `HK_MANUAL_MESSAGE_1` / Abracadoo.app profile artifacts. Optional envelope reservations exist for future proof, witness, controlled-verifiability, deniability, and time-profile layers, but V0.7.2 does not implement full Abracadabracadoo core proof artifacts.

Public/broadcast/listening Paths, image/photo/QR carriers, TIS export, server transport, Nostr transport, conditional deniability crypto, and subjective-epoch TOTP remain out of scope for this pass.

## V0.8: Manual Exchange UX

V0.8 makes the first human-to-human manual exchange easier to understand without changing the trust model.

- The selected Acquaintance view is organized into Verify, Paths, Messages, and History.
- Path invites and sealed messages can be shared by downloaded file or copy/paste JSON text.
- Paste import tolerates whitespace, code blocks, and surrounding text when the Abracadoo JSON object is detectable.
- The UI uses “sealed message” language while keeping `HK_MANUAL_MESSAGE_1` visible as the technical profile.
- Copy reinforces the carrier-independent rule: the Path secures the message, not the carrier, and the carrier does not need plaintext.
- `LoopWitness` semantics remain from V0.7.2: local, `path_pair` scoped, with artifact/ciphertext digests only.
- Relationship remains an Abracadoo.app state: established by witnessed loop, not agreement, legal consent, public trust, emotional closeness, or consent to message contents.
- Explicit consent confirmation, QR/image/photo carriers, public/broadcast/listening Paths, server transport, and Nostr transport remain intentionally out of scope.

## V0.8.1 - 140-character sealed notes

Manual sealed messages are intentionally tiny for now: newly created `HK_MANUAL_MESSAGE_1` notes are limited to 140 characters before encryption. The app does not silently truncate over-limit notes; it blocks creation until the note is shortened.

This is an Abracadoo.app MVP profile constraint, not a universal HumanKey or Abracadabracadoo protocol limit. It keeps the first exchange simple, prepares for future QR/image carriers, and preserves the current rule: the Path secures the message, not the carrier.

Older valid sealed-message artifacts remain importable. LoopWitness and Relationship semantics are unchanged.

## V0.8.2 - Inbound Path opening no longer auto-downloads

Opening an inbound Path now only creates the local receiving Path and prepares the Path invite text in the panel. It does not automatically save/download an invite file.

This keeps the ritual clearer:

- Open inbound Path: creates the local receiving Path and keeps the private receive key in the vault.
- Export or Copy Path invite: deliberately creates the shareable artifact for the other person.

The Path invite remains public/shareable invite material. It is not a vault backup and does not contain the private receive key.
