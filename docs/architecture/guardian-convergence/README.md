# Guardian / Convergence engineering diagrams

Current-state snapshot verified on **24 October 2026**, following the OpenAI
subscription model migration. These diagrams document the deployment and
configured workflows; they do not propose a new architecture.

| View | PNG | Zoomable vector source |
|---|---|---|
| Deployment, service boundaries, ports and data paths | [Architecture](guardian-convergence-architecture.png) | [Architecture SVG](guardian-convergence-architecture.svg) |
| Automatic investigation and operator follow-up | [Sequence](guardian-convergence-sequence.png) | [Sequence SVG](guardian-convergence-sequence.svg) |

Both sheets are included in the [two-page A3 engineering PDF](guardian-convergence-engineering.pdf).
The SVGs contain selectable text and remain sharp when enlarged. Edit the
layout/content in [generate.py](generate.py), then run `python3 generate.py`.
PNG/PDF files are rendered from the generated SVGs with Chromium.

## How to read the architecture

- **Teal:** telemetry collection and observation.
- **Orange:** admission, model orchestration and delegated task execution.
- **Blue, dashed:** queries through the HUD proxy or scoped MCP integrations.
- **Purple:** durable cases, findings and operator feedback.
- **Grey, dotted:** model inference and Gateway control paths.

Ports denote **host bindings**, except where a container/internal port is
explicitly shown. In particular, the HUD uses host port **3000**, Grafana uses
host port **3300**, and Convergence API uses host port **3080**; the latter two
containers each happen to listen on their own internal port 3000.

The dashed Guardian boundary is a separate process/configuration/credential
scope on the **same host**. It is not a separate VM or a claim of complete
resource isolation. The Border and Guardian authenticate separately to the
same ChatGPT/Codex account allowance.

## Current roles and models

| Component | Runtime | Model |
|---|---|---|
| HUD main chat | OpenClaw Gateway, `main` agent | `openai/gpt-6.1-sol`; Luna fallback |
| Alert orchestration | Same Gateway, `alert` agent | `openai/gpt-6-luna` |
| Guardian investigations | Scoped embedded OpenClaw runs, launched by the iN2N member daemon | `openai/gpt-6.1-sol`; Luna fallback |
| Convergence API, PostgreSQL, telemetry collectors | Docker services | No LLM |

The iN2N broker is a **separate host mesh service**, `netclaw-mesh.service`,
listening on loopback port 11790. It is not the OpenClaw Gateway's HTTP listener.
The Gateway reaches it through `n2n-mcp`. Guardian maintains a persistent member
connection and starts a model run when a delegated task arrives.

Guardian retains eight MCP registrations: Prometheus, Grafana, pyATS, pfSense,
UniFi, GreyNoise Community, RAG and memory. The investigation skill instructs it
to collect evidence and report findings, without autonomous remediation.

## Important implementation details

1. **Automatic alerts are policy-gated.** The current policy defaults to T0
   (log/notify without an AI investigation). T2 admits `WanHardDown`, critical
   `SwitchLinkLost`, and `DeviceSnmpExporterDown`, subject to budgets and
   additional suppression checks. The configured limits are three admissions
   per hour, receiver concurrency two, and a 30-minute duplicate TTL.
2. **Concurrency accounting ends after dispatch.** The receiver releases its
   in-flight counters when the hook trigger function returns. A successful
   asynchronous hook acceptance does not establish that the Guardian task has
   finished. The concurrency setting is therefore a receiver admission/trigger
   limit, not an end-to-end worker reservation.
3. **Need More follows a dedicated path.** The browser writes through the HUD
   proxy to Convergence API. The API reopens the existing event and calls
   receiver `/reinvestigate`; that endpoint posts directly to `/hooks/alert`.
   It does not call the automatic policy/admission functions.
4. **Case and task identities differ.** `event_id` identifies the durable diary
   case; the alert fingerprint groups the alert and keys the hook session;
   `task_id` identifies an individual delegated execution. A follow-up retains
   the case and includes the operator's notes.
5. **Notification and learning actions are part of the configured procedure.**
   The worker records findings, reports to Discord and requests a RAG snapshot
   after a meaningful resolved/escalated case. Telemetry availability is
   independent of those LLM-driven actions.

## Verification and evidence

Verified service listeners, running Docker containers, live HUD/API model
settings, receiver policy status and Guardian member enrollment. Live reply
checks succeeded for HUD chat, alert orchestration and the isolated Guardian
profile. No new monitoring incident was injected to create these diagrams.

Sources:

- [Convergence overview](../../CONVERGENCE.md)
- [Model configuration and subscription authentication](../../MODELS.md)
- [Alert receiver implementation](../../../services/alert-receiver/server.py)
- [Automatic investigation policy logic](../../../services/alert-receiver/investigation_policy.py)
- [Convergence event lifecycle and reinvestigation](../../../ui/convergence-api/src/routes/events.js)
- [HUD Convergence proxy](../../../ui/netclaw-visual/modules/convergence/server.js)
- [Guardian investigation procedure](../../../workspace/skills/alert-triage/SKILL.md)
- [iN2N member launcher](../../../scripts/in2n-member.py)
- [Embedded member execution](../../../mcp-servers/protocol-mcp/bgp/federation/gateway.py)
- [Telemetry collector pipelines](../../../deploy/convergence/otel/otel-config.yaml)

Live policy: `~/.openclaw/investigation-policy.yaml` and receiver
`GET http://127.0.0.1:8099/policy/status`.
