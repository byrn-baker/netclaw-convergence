# Proposed tools (NetClaw design, not OpenAI API names)

All tools use strict JSON schemas, reject unknown keys and advertise readOnlyHint=true and destructiveHint=false. These annotations do not enforce authorization; implementation must. No arbitrary URL, path, shell, CLI, Python, tool-name or credential arguments.

| Tool | Input | Output |
|---|---|---|
| netclaw_inventory | empty object | allowed opaque aliases, source category, observed_at, status |
| netclaw_health_summary | aliases: 1–10 allowed strings; checks: nonempty subset of interface_summary/routing_summary/system_summary | per-alias typed observations, freshness, request ID, partial flag |
| netclaw_audit_status | request_id: server-issued ID | caller-scoped decision/completion status; no raw log or evidence download |

Envelope: request_id, mode(synthetic/live), status(ok/partial/unavailable/denied/error/stale), observed_at or null when no observation, data, safe error code. Never turn failure into empty success. Synthetic data must visibly carry mode=synthetic.

Proposed hard limits: 30 seconds per request, maximum 10 aliases, 16 KiB encoded output, no unrestricted pagination. Truncation is explicit; never truncate away failure indications. Audit reads cannot cross principals. Health checks map to reviewed backend operations, not model-supplied show commands. Live output requires schema validation plus a reviewed non-sensitive classification; regex secret filtering alone is insufficient.

Authentication/transport wire schema remains gated by T003. Use current official host mechanisms; no invented Dot credentials. Unit-test identity mapping and scope without real accounts. Writes always return denied before any backend call, even when a user supplies a CR number or says lab mode.
