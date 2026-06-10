# Abracadoo HumanKey Seed — V0.6.1 Path / Loop Terminology Alignment

V0.6.1 renames the app-native communication primitive from **Lane** to **Path**.

## Ontology

- A **Path** is one-way.
- Two compatible connected Paths form a **Loop**.
- A **Relationship** requires a witnessed/completed Loop.

This keeps the ecosystem language aligned with Abracadoo's broader trust model: a one-way receiving or sending route is not yet mutuality. Mutuality emerges when paths connect and carry a reciprocal exchange.

## Code/domain changes

- `HumanKeyLane` -> `HumanKeyPath`
- `LaneId` -> `PathId`
- `LaneDirection` -> `PathDirection`
- `HK_LANE_1` -> `HK_PATH_1`
- `HumanKeyLaneInvite` -> `HumanKeyPathInvite`
- `ABRACADOO_HUMANKEY_LANE_INVITE` -> `ABRACADOO_HUMANKEY_PATH_INVITE`
- `createInboundLane()` -> `createInboundPath()`
- `recordLaneShared()` -> `recordPathShared()`
- `importLaneInvite()` -> `importPathInvite()`
- `lane.created/shared/imported` -> `path.created/shared/imported`

## Compatibility

V0.6.1 still accepts legacy V0.6 lane invite artifacts during import and normalizes them into `HK_PATH_1` outbound paths. Backup import also accepts older `lanes` arrays / `lane.*` events and normalizes them to `paths` / `path.*`.

The browser IndexedDB adapter reads both the new `paths` store and the legacy `lanes` store so early V0.6 test data is not immediately stranded.

## What did not change

Path exchange still does **not** establish a Relationship. V0.6.1 remains a terminology and compatibility pass, not a messaging or Loop witness implementation.
