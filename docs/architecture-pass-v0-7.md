# Abracadoo HumanKey V0.7 — Loop Witness / Manual Message Exchange

V0.7 makes the Path/Loop model operational without depending on a server, Nostr relay, or any automated transport.

## Core addition

A **manual message** is an encrypted HumanKey artifact that can be moved by any human-mediated channel:

- copy/paste
- email
- SMS
- QR in a later UI
- printed file/text
- shared drive
- any temporary channel the parties trust long enough to move the artifact

The artifact is transport-independent. The trust semantics remain HumanKey-native.

## New artifact

```text
ABRACADOO_HUMANKEY_MANUAL_MESSAGE
```

The artifact contains:

- message id
- recipient path id
- creation timestamp
- ephemeral sender public key
- AES-GCM IV
- ciphertext

It does **not** contain TOTP secret material or inbound path private key material.

## Security shape

V0.7 creates inbound path receive keys using Web Crypto ECDH P-256. The public key is exported in the Path invite. The private receive key is stored behind the local `SecretVault` boundary.

Message encryption uses:

```text
ECDH P-256 -> derived AES-GCM 256-bit key -> encrypted manual artifact
```

This is still an MVP protocol profile, not a formal audited cryptographic standard.

## Loop witness rule

A contact becomes a Relationship only after the local app witnesses both:

```text
message.sent
message.received
```

When both exist, the app records:

```text
loop.completed
relationship.established
```

This preserves the ontology:

```text
A Path is one-way.
A Loop is two connected Paths.
A Relationship is a witnessed Loop.
```

## Backup impact

Backups now include active inbound path private receive keys through the same secret export/import service used for TOTP secrets. Encrypted backups remain passphrase-wrapped.

## UX status

The UI now supports:

- create inbound path
- export path invite
- import path invite
- export encrypted manual message over an outbound path
- import/decrypt encrypted manual message on an inbound path
- display the last decrypted message in-memory for the selected contact
- establish Relationship after sent + received messages are witnessed

