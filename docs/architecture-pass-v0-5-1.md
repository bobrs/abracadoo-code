# Architecture pass V0.5.1: vault confidence and invited Acquaintance state

V0.5.1 is a focused confidence/polish pass on top of the encrypted local vault.

## Changes

- The Local Vault status pill now has explicit `new`, `locked`, and `unlocked` visual states and explanatory titles.
- Vault and backup passphrase failures are translated into a friendlier message instead of exposing low-level Web Crypto errors.
- Exporting an encrypted backup now presents a recovery warning before download.
- Exported encrypted backups are immediately decrypted in memory with the entered passphrase as a self-check before the file is saved.
- The contact list now derives a UI status from the event spine.
- An Acquaintance whose credential or path has been shared/invited but who has never successfully validated is shown with an orange `acquaintance` label.

## Ontology note

The orange label is a UI emphasis only. The domain state remains `acquaintance`. Verification still proves possession, and Relationship still requires a completed reciprocal app-native loop.
