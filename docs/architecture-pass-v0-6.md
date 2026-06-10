# Abracadoo HumanKey Seed — V0.6 Lane Invite Model

V0.6 adds the first visible app-native lane primitive while preserving the Acquaintance/Relationship distinction.

## What changed

- Added `HK_LANE_1` lane invite services:
  - `createInboundLane()`
  - `recordLaneShared()`
  - `importLaneInvite()`
- Added a public lane invite artifact:
  - `ABRACADOO_HUMANKEY_LANE_INVITE`
  - contains no TOTP secret material
  - represents a receiving boundary that can be imported as an outbound lane
- Added UI for selected Acquaintances:
  - create inbound lane
  - export lane invite
  - import lane invite as outbound lane
  - show inbound/outbound lane counts
- Added `lane.imported` event type.
- Updated contact state derivation so `lane.shared` or `lane.imported` moves the contact into `loop_offered`.
- Added tests ensuring lane exchange does not establish a Relationship.

## Important ontology rule

Lane exchange is not a Relationship. It only means a one-way app-native communication path has been offered or imported.

A Relationship still requires a completed reciprocal app-native loop, such as a successful two-way message exchange recorded by future `message.sent`, `message.received`, `loop.completed`, and `relationship.established` events.

## Transport posture

V0.6 uses a local/manual transport descriptor. This intentionally avoids letting Nostr, server transport, or any future delivery mechanism define the HumanKey ontology.

The HumanKey lane model now exists before any real message delivery adapter exists.
