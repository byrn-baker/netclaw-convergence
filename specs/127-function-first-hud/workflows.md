# Operator workflows and coverage

Specification, not shipped UI. All panels share source/scope/time, explicit failure states and a scoped “Investigate in canvas” action. An investigation action prepares context and waits for the operator to send it.

## Navigation and presentation

Header: installation identity/role, data freshness, Basic/Advanced toggle, Chat, Canvas. Primary navigation: Overview, Investigations, Risk of Claws, Neighbours, Mobile, Science Officer, Network, Knowledge, Operations, Integrations, Settings. Search reaches every capability; Basic groups secondary destinations under “More” without removing access.

On desktop, the dashboard uses a main panel and an optional detail inspector; Canvas can take the entire workspace. At narrow widths panels stack and details become a navigable page/sheet with a clear Back action. Switching view preserves the active draft and selection. No mandatory 3D background or continuously moving scene.

| Surface | Basic operator workflow | Advanced detail | Existing source / implementation gap |
|---|---|---|---|
| Overview | See attention items, gateway, active work and stale sources | Scope, posture, source failures and refresh times | `/api/health`, `/api/gateway/status`, normalized existing feeds; aggregate contract needed |
| Investigations | Ask Border; open full Adam canvas | Branches, synthesis, context/source/action, sessions, attachments | `/api/chat`, `canvas-chat/App.jsx`; preserve direct route and IndexedDB |
| Risk of Claws / iN2N | Who belongs and who can help | Eligibility, capability scopes, work, enforcement gaps and audit state | `/api/n2n`, orgchart modules; inspect actual field coverage before mapping |
| External neighbours / eN2N | Which peers are connected; who answered | Stable peer identity, trust, advertised vs authorized capabilities, cited remote knowledge | `/api/n2n`, peer-detail; no invented remote inventory |
| Mobile | Enrolled devices, last seen, available capabilities | Transport, command/capture/approval state when authorized and recorded | Edge records in N2N; detail feed gaps must be explicit |
| Jev / Science Officer | Advice status and Border's reported influence | Exact Noul/Choice/Score questions/results, rubric, evidence, model, spend, reconsideration | Existing advisors snapshot plus **new trusted mediation**; never fetch a global ledger |
| Network inventory / health | Findings by device/site and severity | Vendor, interface, source, age, failed collectors, intent/state differences | Existing skill/tool evidence; no generic live inventory feed assumed |
| Routing / topology / paths | Inspect affected devices and paths | BGP/IGP, VRF, snapshot epoch, observed vs simulated paths | `/api/bgp`, scoped tool evidence; optional sourced Three.js topology |
| Telemetry / events | Recent relevant events and collection gaps | gNMI, syslog, traps, flows, retention and observation windows | Existing integrations; structured presentation adapters required where feeds are absent |
| Security / posture | Findings and missing controls | DefenseClaw, containment, trust, enforcement vs audit-only, validation verdicts | Existing posture/evidence; no aggregate invented health percentage |
| Incidents / changes / approvals | What needs human attention | Baseline, CR state, approver, verification, rollback and failure | Existing ITSM/approval workflows; no new direct config push path |
| Integrations / skills | Search what NetClaw can do and setup state | Owner, transport, installed/configured/reachable distinctions, read/write capability | `/api/graph`, `/api/skill/:skillId`; category membership is not reachability |
| RAG / knowledge | Find documents and cited context | Collection scope, ingestion state, local vs federated retrieval/replication consent | Existing KnowledgePanel and RAG routes; preserve supported controls |
| Memory | Find relevant prior decisions | Provenance and temporal validity; distinguish memory from live evidence | Memory/MemPalace integrations; no browser search feed assumed |
| GCF / context efficiency | See context use where measured | Input/output chars, token estimates, compression provenance and gaps | Inspect current GCF producer before adding adapter; no savings guesses |
| Usage / budgets | Spend and remaining configured budget | Provider usage vs estimates, Jev daily/task cap, currencies/time windows | Existing budget routes and Jev status; separate scopes |
| Zoom / meeting context | Find permitted meeting evidence | Meeting/source identity, retrieval time, historical vs live | Existing Zoom module; connection and permission gaps explicit |
| Audit / reports / artifacts | Follow a finding to its evidence or report | GAIT/task/change links, source records and export provenance | Existing session/tool history and artifact workflows; authorization review required |
| Settings / existing utilities | Locate setup and supported controls | Budget, environment/testbed/layout controls and existing Twitter panel | Preserve access restrictions and existing confirmations; classify controls before relocation |

## Deployment fixture matrix

| Fixture | Expected distinction |
|---|---|
| Standalone, no Jev or federation | Local HUD works; optional services say not configured |
| Standalone + Jev | Advisor is visible without a fake RISK/member enrollment |
| Border + iN2N members | Execution member counts exclude advisors; mobile edge count explicit |
| Border + iN2N + eN2N + mobile + Jev | Every entity class and trust boundary is separate; same names remain distinguishable |
| eN2N only | External federation works without invented internal membership |
| Member installation | Local view; unavailable Border data is not implied access |
| Partial outage / denied source | Last-success values marked stale; failures isolated; no false zero totals |

Every fixture runs in Basic and Advanced. Real mobile-device acceptance is separate from a responsive browser viewport check.

## Three.js use criteria

Use Three.js for a selected RISK/federation relationship map or sourced network topology/path where depth/grouping helps inspection. Tables are the default operational view. Every graph has a legend, scope, timestamp, selected-entity inspector and table alternative. No random traffic, simulated health pulse or invented link is presented as observed activity. A simulation is labeled as a simulation with its input snapshot. Retain Adam's existing SVG canvas graph independently.
