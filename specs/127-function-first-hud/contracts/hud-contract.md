# Proposed HUD contract and security boundary

This is a design contract, not an implemented endpoint inventory. Existing routes remain compatible. New network/tool integrations continue through MCP; HTTP routes below mediate the local browser experience only.

## Dashboard reads

Normalize each source independently into the Observation/EntityRef shapes in [data-model.md](../data-model.md). A source failure does not fail the whole overview. Lists are bounded/paginated; exact counts require complete coverage, otherwise show returned/known scope and truncation. Polling is bounded and paused when hidden; read retries do not replay actions.

Existing `/api/n2n` advisors remain status-only. No question, raw evidence, endpoint secret or task-private content is added to that feed. New session-private events must not use the existing global broadcast path.

## Trusted Jev detail mediation

Proposed route: `GET /api/hud/tasks/:taskRef/assessments/:assessmentId`. Path IDs are lookup hints, not authority. No route lists the whole ledger and no request supplies a filesystem path, provider endpoint or arbitrary MCP command.

1. Apply current local Host/Origin restrictions and establish an authenticated server session. The implementation spike must document the credential/bootstrap mechanism, lifetime and logout/revocation behavior before enabling this route.
2. Resolve session principal and allowed task/message mapping from trusted gateway/runtime provenance. Browser IndexedDB IDs or model-written assessment links cannot establish this mapping.
3. Verify assessment membership and optional parent in that task. Invoke the existing MCP read under an immutable task-bound context; concurrent requests must not race through a shared environment variable.
4. Return an allowlisted typed detail response plus binding state and Border-authored influence if recorded. Evidence content must obey the caller's access scope; redacted/missing evidence remains visibly redacted/missing. No credentials or raw provider errors are returned.
5. Send `Cache-Control: no-store`. Keep detail out of global histories, broadcast events, analytics and error logs. Audit safe identifiers/outcomes without duplicating private question/evidence text.

| Outcome | HTTP/application behavior |
|---|---|
| Authenticated and authorized | 200 with exact task-bound detail |
| No authenticated session | 401, no detail |
| Local-origin restriction fails | 403, no detail |
| Missing/foreign/expired assessment ownership | Uniform 404 with safe `unavailable` reason; no existence oracle |
| Current message has no trusted binding | Client shows `unbound`; no fallback lookup or global latest call |
| Authorized backend unavailable | 503, safe `unavailable`; never empty success |
| Bounded read timeout | 504; retry read only, never evaluate |

The exact route may change during implementation, but authorization, response semantics and no-inference behavior are mandatory.

## Canvas linkage and session safety

Preserve the current message/messages chat request for old clients. Additive response metadata may carry a server-issued opaque task/message reference. Authenticated binding must originate from runtime execution and must use the same originating task identity as Jev budgets; it cannot mint new task IDs per refresh/retry to evade limits.

Attach metadata to the exact returned message/node under the session gate. Do not parse authority out of model prose. A reference opened from imported or legacy content remains unbound unless the server independently authorizes it. Original/reconsideration comparisons use explicit IDs and validated lineage, never timestamps.

## Actions

“Investigate in canvas” prepares selected evidence and retains source/scope/time. User sends through the existing chat/tool workflow. Panel rendering, refresh, graph selection and mode changes are read-only. Existing settings/RAG/mobile/approval actions retain their supported validation, confirmation and authorization; there is no generic browser arbitrary-tool dispatcher.

## Required abuse cases

Foreign task IDs; same principal but wrong session association; forged message ID; imported assessment ID; cross-task parent; expired session; concurrent tasks; task-budget reset attempt; malicious Markdown/HTML; fake provider error containing secrets; WS/global-history leaks; stale response after navigation; denied evidence reference; public-origin access. All must be tested before detailed assessment access is enabled.

## Implemented binding choice — 2026-09-28

The server uses local-origin bootstrap plus a random HttpOnly SameSite cookie to
identify the local operator's browser session. Private records live in
`~/.openclaw/hud-bindings`, expire after30days and support explicit revocation.
Client thread IDs are hashed lookup hints into server-generated task/session IDs.
The gateway's supported `x-openclaw-session-key` receives the server-generated value.
Only exact `sessions.json`→session-ID→transcript ownership plus matching new runtime
Jev tool-result events grants access. Before/after identity uses message IDs, never
times; a missing baseline denies linkage except for a newly minted gateway session.
Duplicate assessment IDs retain their original message association.

The reader invokes existing MCP `jev_assessment` in a dedicated process with
`--read-task-id`; this disables evaluation and preserves the original ledger budget
case. At most4reads run concurrently. Records and one validated parent are projected
without endpoint credentials/raw state. Border's optional typed influence is
associated only after proof exists; it is not authority. Reads attempt GAIT with
safe identifiers and report its availability. Current implementation returns503for
backend/read-lineage failure; foreign ownership is uniformly404. A dedicated504
classification remains a refinement rather than a success assertion.

Detailed browser/gateway acceptance is pending under the current sandbox/browser
restrictions; direct MCP/route tests do not substitute for it.
