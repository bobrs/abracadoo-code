# Abracadoo / HumanKey Ontology

## Acquaintance

An Acquaintance is a locally named HumanKey contact for whom I hold at least one one-way verification credential or lane, but with whom no reciprocal communication loop has yet been witnessed.

In the MVP, creating an Authenticator-compatible TOTP credential for someone creates an Acquaintance.

## Relationship

A Relationship is a HumanKey contact with at least one completed reciprocal app-native loop, such as a successful two-way message exchange.

Authentication proves possession. Messaging proves a living channel. Relationship requires a completed loop.

## Directionality

Credential directions:

- `i_verify_them`: I created this credential; I trust it when they present a valid code.
- `they_verify_me`: They created this credential; I hold it so I can prove myself to them.

Lane directions:

- `inbound`: I control this lane; they may send to me through it.
- `outbound`: They control this lane; I may send to them through it.

## Lifecycle

Suggested contact states:

- `draft`
- `acquaintance`
- `loop_offered`
- `loop_witnessed`
- `relationship`
- `paused`
- `revoked`
- `archived`
