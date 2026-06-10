# Abracadoo HumanKey V0.8 - Manual Exchange UX

V0.8 is a conservative UX pass on top of V0.7.2. It does not change the trust model, add server transport, add Nostr, add public/broadcast/listening Paths, add QR/image/photo carriers, implement explicit consent confirmation, or implement full Abracadabracadoo core proofs.

## Manual Exchange

The selected Acquaintance view is now split into:

- Verify
- Paths
- Messages
- History

The same local HumanKey services remain responsible for creating credentials, Paths, sealed messages, LoopWitness records, and events.

## Path Invites

Path invites can be shared by file download/upload or by copy/paste JSON text.

The UI copy is intentionally plain:

```text
A Path is one-way.
Share your Path invite so this person can send sealed notes to you.
Import their Path invite so you can send sealed notes to them.
A return Path is an invitation, not a demand.
```

Legacy Lane invite artifacts remain accepted for compatibility and are imported as Paths. New exports use Path terminology.

## Sealed Messages

Manual messages remain `ABRACADOO_HUMANKEY_MANUAL_MESSAGE` / `HK_MANUAL_MESSAGE_1` Abracadoo.app profile artifacts. They are not full Abracadabracadoo core proof artifacts.

Sealed messages can be shared by file download/upload or by copy/paste JSON text. Paste import tolerates leading/trailing whitespace, JSON copied from code blocks, and surrounding text when a single Abracadoo JSON object can be detected.

The product rule is:

```text
The Path secures the message, not the carrier.
The carrier does not need to understand it.
```

The carrier may be text, email, file, chat, paper copy, or any other human-mediated route. No plaintext message content, plaintext summaries, or plaintext hashes are stored in default event metadata or LoopWitness records.

## Loop And Relationship

LoopWitness semantics remain from V0.7.2:

- local `ABRACADOO_LOOP_WITNESS`
- `scope: "path_pair"`
- sent/received message IDs as evidence
- artifact and ciphertext digests only
- no plaintext-derived hashes

`loop.completed` references `loopWitnessId`. `relationship.established` remains an Abracadoo.app witnessed-loop state with:

```text
basis: witnessed_manual_loop
explicitConsentConfirmation: absent
consentToContents: false
```

Relationship means reciprocal exchange was observed. It does not mean agreement, legal consent, durable identity, public trust, emotional closeness, or consent to message contents.

Explicit consent confirmation remains reserved for a later layer through `consent.confirmed` and `message.consent_confirmed`.

## Out Of Scope

V0.8 intentionally does not include:

- QR/image/photo carriers
- public, broadcast, or listening Paths
- server transport
- Nostr transport
- explicit consent confirmation
- full Abracadabracadoo core proof flow
- conditional deniability crypto
- subjective-epoch TOTP
