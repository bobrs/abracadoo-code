# Architecture Pass V0.5.2: Cloudflare Lockfile Hygiene

V0.5.2 is a tiny deployment-hygiene patch.

## Change

- Removed `package-lock.json` from the scaffold package.
- Added `.npmrc` with `package-lock=false` so `npm install` does not immediately recreate it.
- Kept `audit=false`, `fund=false`, and `progress=false` to reduce CI noise.

## Why

Cloudflare Pages was repeatedly hanging during dependency install when the generated lockfile was present. This is not the final dependency-management posture. It is a temporary momentum-preserving choice while the application architecture is still changing quickly.

## Later hardening

Before treating the repo as stable, revisit dependency hygiene:

1. Pin Node and npm versions intentionally.
2. Regenerate `package-lock.json` with the chosen toolchain.
3. Switch CI to `npm ci`.
4. Commit the lockfile once Cloudflare Pages installs consistently.
