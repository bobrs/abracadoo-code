# Architecture Pass V0.2: Runtime and Adapter Boundary

This pass preserves the Acquaintance-first HumanKey ontology while adding the missing adapter shell.

## Decision

HumanKey remains the trust ontology. Runtime adapters are temporary embodiments.

A local personal deployment, server-backed community deployment, Nostr-backed transport, or fully manual offline workflow should all preserve the same concepts:

- Contact
- Acquaintance
- Credential
- Lane
- Event
- Relationship

## Runtime

`AbracadooRuntime` bundles the replaceable dependencies:

- `storage`
- `vault`
- `transports`
- `policy`
- `clock`
- `crypto`

This prevents UI and services from hardcoding one environment.

## Adapter categories

### Storage

Stores contacts, credentials, lanes, and events.

Current implementation: `InMemoryStorageAdapter`.

Future implementations:

- `IndexedDbStorageAdapter`
- `ServerStorageAdapter`
- `FileExportStorageAdapter`

### Vault

Stores secret material behind `SecretRef`.

Current implementation: `InMemorySecretVault`.

Future implementations:

- `IndexedDbSecretVault`
- `EncryptedLocalVault`
- `ServerWrappedVault`
- `HardwareBackedVault`

### Transport

Moves messages or exchange artifacts.

Current implementation: `ManualTransportAdapter`, representing QR, copy/paste, phone, printed code, or other human-mediated exchange.

Future implementations:

- `ServerTransportAdapter`
- `NostrTransportAdapter`
- `WebPushTransportAdapter`
- `OfflineQueueTransportAdapter`

### Policy

Decides whether a given action is allowed in the current context.

Current implementation: `LocalPersonalPolicyAdapter`.

Future implementations:

- `CommunityPolicyAdapter`
- `BusinessPolicyAdapter`
- `ServerManagedPolicyAdapter`

## Services

Domain services now own multi-object updates:

- Create contact
- Create credential
- Record event
- Update derived state
- Persist through storage
- Use vault through `SecretRef`
- Respect policy decisions

UI should call services rather than directly mutating HumanKey objects.

## Invariant preserved

Authentication proves possession.
Messaging proves a living channel.
Relationship requires a completed reciprocal loop.
