# Abracadoo HumanKey Seed — V0.6 Path Invite Model

V0.6 adds the first visible app-native path primitive while preserving the Acquaintance/Relationship distinction.

## What changed

- Added `HK_PATH_1` path invite services:
  - `createInboundPath()`
  - `recordPathShared()`
  - `importPathInvite()`
- Added a public path invite artifact:
  - `ABRACADOO_HUMANKEY_PATH_INVITE`
  - contains no TOTP secret material
  - represents a receiving boundary that can be imported as an outbound path
- Added UI for selected Acquaintances:
  - create inbound path
  - export path invite
  - import path invite as outbound path
  - show inbound/outbound path counts
- Added `path.imported` event type.
- Updated contact state derivation so `path.shared` or `path.imported` moves the contact into `loop_offered`.
- Added tests ensuring path exchange does not establish a Relationship.

## Important ontology rule

Path exchange is not a Relationship. It only means a one-way app-native communication path has been offered or imported.

A Relationship still requires a completed reciprocal app-native loop, such as a successful two-way message exchange recorded by future `message.sent`, `message.received`, `loop.completed`, and `relationship.established` events.

## Transport posture

V0.6 uses a local/manual transport descriptor. This intentionally avoids letting Nostr, server transport, or any future delivery mechanism define the HumanKey ontology.

The HumanKey path model now exists before any real message delivery adapter exists.
