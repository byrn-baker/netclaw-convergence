# Mac review of partial WSL return — 2026-10-11

Fetched and inspected `1aaaafac8a47a918e37849b3266d4e1796326a3a` in a new
`150-vscode-extension-wsl-review-20261011` worktree. Owner and earlier recovery
checkouts were preserved. The return contains two documentation/evidence commits
after `c21b4f8`; it changes no extension or backend implementation.

- Recomputed candidate SHA-256:
  `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
- Confirmed cumulative source diff from `f943637` remains confined to
  `extensions/netclaw-vscode/` and `specs/150-vscode-extension/`.
- Compared the owner source `aa27953` HUD package/lockfile, launch/Node-policy and
  runtime-selection scripts with `f943637`: no differences. The MCP client is
  already pinned at 2.3.1. The import that fails is present in unchanged source.
- Reviewed the returned matrix and sanitized report: activation and developer
  checks passed, live acceptance and isolated lifecycle did not run successfully.
  No result was promoted to acceptance, and no task checkmark was added.
- Prepared [bounded prerequisite recovery](../wsl-prerequisite-recovery.md),
  including service observation, staged locked dependencies, existing supported
  Node selection, backup/rollback, native identity behavior and editor update
  handling. Its apply phase requires owner approval because the previous WSL
  instruction explicitly excluded owner installation repair.

No backend/extension code, package, owner service, credential or publisher change
was made on Mac. No WSL operation was performed remotely. Source tests were not
repeated for this documentation-only review; prior results retain their original
host/fixture limitations. T022 and T023 remain open; nothing merged or published.

Startup pyATS inventory failed because this Mac session has no valid
`PYATS_TESTBED_PATH`; no device command followed. No MemPalace connector is exposed
in this session. GAIT and the local daily log record the review and final handoff.
