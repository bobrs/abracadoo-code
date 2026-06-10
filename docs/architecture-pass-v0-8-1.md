# Abracadoo HumanKey V0.8.1 - 140-Character Sealed Notes

V0.8.1 is a narrow constraint pass before QR/image/photo carriers and before fuller Abracadabracadoo messaging/proof flow.

## Sealed Note Limit

Newly created manual sealed messages are limited to 140 characters of plaintext before encryption.

This limit applies to `ABRACADOO_HUMANKEY_MANUAL_MESSAGE` / `HK_MANUAL_MESSAGE_1` creation in the Abracadoo.app MVP profile. It is not a universal HumanKey or Abracadabracadoo protocol limit.

The app does not silently truncate notes. Over-limit notes are rejected before encryption/export.

## Why

Short sealed notes simplify the first manual exchange and prepare for future QR/image carriers where smaller payloads are more reliably scannable.

The product framing is:

```text
Small enough to travel almost anywhere.
Enough to say: I’m here.
Enough to witness a Loop.
```

Longer messages are reserved for fuller Abracadabracadoo messaging/proof flow.

## Artifact Profile

Newly created sealed-message artifacts include an optional profile marker:

```text
messageProfile.name: sealed_note
messageProfile.maxPlaintextChars: 140
```

Older V0.8 artifacts remain importable. Imported historical artifacts are not rejected solely because their decrypted plaintext exceeds 140 characters.

## Privacy And Witnessing

The character limit does not change V0.7.2/V0.8 semantics:

- LoopWitness records remain local `ABRACADOO_LOOP_WITNESS` records.
- LoopWitness records store sent/received message IDs and artifact/ciphertext digests only.
- No plaintext message content, plaintext summaries, or plaintext hashes are stored in default events or LoopWitness records.
- Relationship remains an Abracadoo.app witnessed-loop state, not agreement or consent to message contents.
