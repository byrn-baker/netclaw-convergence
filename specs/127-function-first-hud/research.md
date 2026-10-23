# Repository research — 2026-09-27

Read-only source inspection; no live network-health conclusions and no claim that the redesign exists.

| Finding | Source | Design consequence |
|---|---|---|
| Handoff explicitly requires workflows and acceptance before runtime redesign | `specs/126-readme-refresh/continuation.md` | Deliver this specification package first |
| Canvas is an existing React spatial workspace with branch/synthesis relationships and context/summary/sources/action content | `ui/netclaw-visual/src/canvas-chat/App.jsx` | Preserve and extend it; do not replace it with a drawer |
| Canvas stores sessions in IndexedDB `netclaw-canvas` and exposes import/export | Same file, persistence and session functions | Capture old-format fixtures; preserve origin/database identity; additive metadata only |
| Session gate prevents changes while requests/saves are active | `src/canvas-chat/session-gate.js` | Keep gate; add detail-response identity checks |
| Both HUD and canvas are Vite build inputs | `ui/netclaw-visual/vite.config.js` | Preserve both entry points and deployment paths |
| Canvas `/api/chat` body currently sends message/messages, without a trusted task binding | Canvas `netclawChat` transport and `server.js` chat handler | Browser session/node IDs cannot authorize Jev details |
| Chat handler has shared legacy history and broadcasts activation content; tool extraction follows latest transcript | `server.js`, `/api/chat`, `/api/chat/history`, WS broadcast and session/tool routes | Audit shared surfaces before introducing private assessment details; restrict new events to authenticated task owners; do not attach by time |
| Local access middleware checks allowed Host/Origin and cross-site requests | `src/security/local-access.js` | Keep local protections; they do not establish per-task ownership |
| Jev snapshot is deliberately allowlisted and advisor-only | `src/orgchart/science-officer.js` | Do not expand global status into a detailed ledger feed |
| `jev_assessment` retrieves using configured trusted task scope | `mcp-servers/jev-mcp/server.py` | Mediation must use a trusted task-bound invocation; no global mutable task-env switch |
| Peer normalization, freshness, liveness, layout, accessibility and graph rendering already exist | `src/orgchart/`, `src/orgchart-render/` | Reuse semantics with targeted review, especially stable IDs and unavailable state |
| HUD already has graph, N2N, BGP, budget, RAG, settings, sessions and tool routes | `ui/netclaw-visual/server.js` | Inventory and preserve supported flows before replacing navigation |
| Three.js, React, Vite and Express already belong to this application | `ui/netclaw-visual/package.json` | No new framework or public hosting service needed |

## Decisions

1. Basic first-run default, Advanced as progressive detail. Mode affects presentation only.
2. Keep canvas as a full workspace and direct route. Initially extend it through small explicit interfaces; do not begin by extracting/rebuilding its large component.
3. Start dashboard reads from normalized existing feeds; each capability without a feed gets an honest investigation/setup path until an adapter is implemented and verified.
4. Build trusted task/message linkage before detailed Jev UI. Local-origin gating, client IDs and imported files are not ownership evidence.
5. Keep the global Jev card status-only. Original/reconsideration and Border influence belong to the originating task's authorized detail view.
6. Three.js is lazy and optional. Do not move Adam's SVG conversation rendering into WebGL.

## Implementation investigations still required

The exact gateway task-binding hook and authenticated session bootstrap need a focused implementation spike; the existing chat compatibility response does not expose that contract. If neither runtime provides a trustworthy binding, ship an explicit unavailable detail state until the bridge exists; never substitute timestamp matching. Inventory GCF, mobile approval and artifact producers before promising direct feeds. Native Linux and WSL host behavior remain separate acceptance work.
