# Abracadoo HumanKey V0.7.1 - Loop Witness Confidence

V0.7.1 is a small confidence pass on the V0.7 manual message flow. It does not add a server, Nostr transport, QR message exchange, or a new schema.

## Semantic fixes

- Importing someone else's Path invite now creates only an outbound Path. It does not create unused inbound receive-key secret material.
- Backup import restores path receive-key secrets with the `HK_PATH_1_RECEIVE_KEY` purpose instead of treating every restored secret as `HK_TOTP_1`.

## Loop witness behavior

The current witness rule remains a coarse contact-level rule:

```text
message.sent + message.received -> loop.completed -> relationship.established
```

This pass makes that rule cleaner:

- sent-only does not establish a Relationship
- received-only does not establish a Relationship
- sent + received establishes a Relationship
- repeated witness checks do not duplicate `loop.completed` or `relationship.established`

Path-pair-specific Loop modeling is intentionally left for a later migration.

## Manual message errors

Manual message import now has stable domain error codes for:

- malformed artifact
- no matching inbound Path
- wrong Acquaintance / recipient
- locked vault
- decrypt failure / wrong key

The browser UI maps those to warm user-facing messages.

## UI copy

The selected Acquaintance panel now shows a clear Loop / Relationship status area. The event spine uses friendly labels such as "Message sent", "Message received", "Loop completed", and "Relationship established", with raw event types kept as secondary detail.

Manual exchange copy now says:

```text
Send this file by any carrier.
The Path secures the message, not the carrier.
```

## Compatibility

V0.7.1 continues to accept legacy V0.6 lane invites, lane backup arrays, and lane events during import. New exports continue to use Path terminology.
