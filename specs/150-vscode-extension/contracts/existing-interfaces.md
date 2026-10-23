# Existing-interface contract

Baseline: unchanged main f943637, NetClaw 1.8.0. This document describes a client
contract; it does not add routes or schemas to NetClaw.

- Identity: GET /api/runtime; require installationId, kind and capabilities.
- Every operational request uses x-netclaw-installation; verify identity on connect
  and before human-reviewed mutations. No automatic redirect or submission retry.
- Local access: numeric loopback HTTP on explicit API port. Existing same-host
  protection is not remote user authentication. WSL/SSH uses the remote host.
- Session: POST /api/hud/session creates an independent HttpOnly nc_hud_* cookie.
- Chat/conversations: use existing per-runtime routes and owned session checks.
- RAG: /api/rag/{search,documents,stats,upload}; honor existing response schemas.
- Inspection: fixed allowlist of HUD GET routes; no arbitrary path from model/UI.
- Writes: native operator review, fixed route/body mapping, backend authorization.
- Assistants: inspect, owned delegate, draft proposal only. No approve/apply/raw
  endpoint/shell tools. Tool descriptions disclose provider/data boundaries.

Tests must prove these behaviors against source routes, not only mock contracts.
Detailed mapping and unavailable operations are recorded with implementation evidence.
