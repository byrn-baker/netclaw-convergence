# Plan: iN2N member provider assignments

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Reconstructed scope

Preserve [spec.md](spec.md) and [tasks.md](tasks.md) as the original deployment
proposal. Use [research.md](research.md) to distinguish repository tooling from
historical model and operator-specific configuration claims.

## Verification sequence before any future deployment

1. Inventory the selected member profiles, existing homes and service ownership
   read-only; capture current configuration without logging credentials.
2. Generate scoped member configurations into an isolated location and verify
   exact MCP/tool grants and provider/model settings against current interfaces.
3. Qualify connectivity, tool calls and fallback with authorized provider access;
   a successful generation script alone is insufficient.
4. Apply a separately authorized migration with preserved homes/credentials and
   verify each member before removing any legacy configuration.

This artifact repair changes no runtime configuration and does not execute the
original task list's operator-specific commands. Existing model names may require
replacement after current availability and compatibility are checked.
