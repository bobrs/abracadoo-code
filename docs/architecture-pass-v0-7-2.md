# Abracadoo HumanKey V0.7.2 - Witness & Forgetting Alignment

V0.7.2 is a narrow protocol-alignment pass before V0.8 manual exchange UX. It keeps the app local-first and does not add server transport, Nostr, QR/image carriers, public/broadcast Paths, TIS export, full Abracadabracadoo core proofs, conditional deniability crypto, or subjective-epoch TOTP.

## Local LoopWitness

The app now stores local `ABRACADOO_LOOP_WITNESS` records when reciprocal manual exchange is witnessed.

The witness is local-only and records:

- `loopWitnessId`
- `loopId`
- `basis: "manual_message_exchange"`
- `scope: "path_pair"`
- local contact and Path references
- public-key / path-key references or digests, not plaintext identity claims
- sent and received message ids
- artifact and ciphertext digests
- consent flags set to `not_claimed`

LoopWitness records do not store message plaintext, plaintext summaries, or plaintext hashes.

## Relationship Scope

`relationship.established` remains an Abracadoo.app profile state. It means:

```text
Relationship established by witnessed loop.
```

It does not mean agreement, legal consent, durable identity, public trust, emotional closeness, or consent to message contents.

New `relationship.established` event data includes:

```text
basis: witnessed_manual_loop
explicitConsentConfirmation: absent
consentToContents: false
```

## Consent Is Reserved

The event namespace reserves:

- `consent.confirmed`
- `message.consent_confirmed`

These are not implemented in V0.7.2. Consent confirmation is a later layer distinct from delivery, receipt, Loop witness, and Relationship status.

## Manual Message Envelope Reservations

Manual message artifacts remain `ABRACADOO_HUMANKEY_MANUAL_MESSAGE` / `HK_MANUAL_MESSAGE_1` app-profile artifacts. They are not full Abracadabracadoo core proof artifacts.

Schema version 1 remains accepted. Optional reserved fields are now tolerated for future layers:

- `proof`
- `witness`
- `controlledVerifiability`
- `deniability`
- `timeProfile`

## Lifecycle Language

- Delete: remove a local visible copy or local record from this device.
- Revoke: mark credential, Path, or Acquaintance unusable going forward.
- Archive: hide or quiet without claiming cryptographic erasure.
- Forget: remove local official capability where possible; do not claim global erasure.
- Backup: encrypted export that may preserve capabilities until destroyed.

Warning:

```text
Restoring an older encrypted backup may restore keys or records that were later deleted or forgotten locally.
```

## Compatibility

Older manual message artifacts still import. Older backups without `loopWitnesses` import with an empty LoopWitness list. Legacy lane invites, lane arrays, and lane events remain accepted and normalized into Path terminology.
