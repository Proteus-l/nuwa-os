# Upstream Metadata

- Source repository: `https://github.com/liigoQi/disco-elysium`
- Imported subtree: `codex-skills/`
- Pinned upstream commit: `82489249e6a7b24c0bfd7330b2b504baca8505c2`
- Imported on: `2026-04-16`

Integration notes:

- This skill pack is stored as a standalone snapshot under `skills/disco-elysium/`.
- No `package.json`, workspace, build, or runtime wiring was added.
- The imported files are intentionally kept outside `packages/*` to avoid impacting active collaborator development and refactors.
- Updating this pack should be done by replacing the snapshot from upstream rather than editing core NUWA-OS modules.
