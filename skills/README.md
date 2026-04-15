# Skills Library

This directory stores third-party and first-party skill packs as static assets.

Design constraints for this library:

- Keep skill packs isolated from `packages/*` so application builds, tests, and refactors are unaffected.
- Prefer vendored snapshots or clearly version-pinned imports over runtime coupling.
- Do not register skills into the runtime automatically from this directory.
- Each skill pack should include upstream/source metadata so it can be updated independently.

Current entries:

- `disco-elysium/`: vendored Codex skill pack adapted from `liigoQi/disco-elysium`
