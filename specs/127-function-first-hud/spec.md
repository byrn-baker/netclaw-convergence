# Feature Specification: Function-first NetClaw HUD

**Feature Branch**: `127-function-first-hud`  
**Created**: 2026-09-27  
**Status**: Ratified by user on 2026-09-28 ("proceed until its 100%"); implementation in progress, local review required before push.  
**Input**: Panels and dashboards for NetClaw in every deployment form, Basic/Advanced toggle, useful Three.js views, detailed Jev Science Officer views, mobile devices and external neighbours. **Adam Mason's context/chat canvas MUST survive.**

## Product outcome

An operator can see what needs attention, inspect the evidence, understand who did the work, and continue the investigation in Border chat or Adam's canvas. Tables, readable panels and explicit status lead the experience. Three.js supports relationship and path exploration when spatial structure helps answer a question.

The dashboard represents standalone NetClaw, a Border and its iN2N Risk of Claws, a member's own authorized view, optional eN2N neighbours, mobile edge devices, and the optional Jev advisor. These dimensions compose; federation is not required to use the HUD. “Risk of Claws” names the group, not a numerical risk score. “Jev Claw” is a display name for the Science Officer, never a new execution role.

Source handoffs: [126 continuation](../126-readme-refresh/continuation.md), [125 Jev/canvas handoff](../125-jev-science-officer/hud-handoff.md).

## User Scenarios & Testing

### User Story 1 — Continue an investigation in Adam's canvas (Priority: P1)

The operator retains the existing spatial conversation workspace, including Border-backed chat, branches, synthesis, attachments, session history and Context/Summary/Sources/Action tabs.

**Why this priority**: Preserving the existing investigation workflow is the release gate for the entire redesign.

**Independent Test**: Open a pre-127 saved session containing a trunk, two branches, a synthesis node and attachments; investigate through dashboard and canvas, then export and reopen the session.

**Acceptance Scenarios**:

1. **Given** an existing session, **when** the new HUD is installed, **then** its node IDs, messages, relationships, attachment references, layout and view preferences remain usable without destructive conversion.
2. **Given** a draft and an active request, **when** switching Basic/Advanced or inspecting a dashboard panel, **then** neither the draft nor the request is lost and no second request is submitted.
3. **Given** a pending reply or save, **when** changing the canvas session, **then** existing session-gate behavior prevents cross-session replies; late panel/detail responses cannot populate a different session.
4. **Given** a dashboard finding, **when** choosing “Investigate in canvas,” **then** the operator sees the exact selected evidence and source/time before sending; unrelated dashboard or sibling-branch content is not silently included.
5. **Given** WebGL is unavailable, **when** opening the canvas, **then** the full existing canvas remains usable. Its SVG conversation graph does not depend on Three.js.

### User Story 2 — Understand the installation at a glance (Priority: P1)

The operator opens Overview and sees identity/role, gateway state, work needing attention, source freshness, current task activity, approvals, and available capabilities.

**Independent Test**: Exercise standalone, Border, member-only and unavailable-source fixtures without performing network writes.

**Acceptance Scenarios**:

1. **Given** standalone NetClaw, **when** opening Overview, **then** local capabilities and chat work; absent RISK/eN2N/Jev are identified as not configured, not failed.
2. **Given** a Border with members, **when** opening its Risk of Claws, **then** execution members, mobile edges, external neighbours and advisors have separate identities, counts and authority labels.
3. **Given** a member installation, **when** opening the dashboard, **then** it displays only permitted local/Border information and never invents a full-risk view.
4. **Given** a source times out, **when** refreshing, **then** its previous data is marked stale with last-success time and failure reason; other panels continue updating.

### User Story 3 — Choose Basic or Advanced presentation (Priority: P1)

Basic opens with plain-language status, attention items, common investigations, chat/canvas and expandable evidence. Advanced exposes technical tables, provenance, task routing, posture, budgets and integration detail.

**Independent Test**: Toggle repeatedly while filtering a table, composing a message and inspecting a finding.

**Acceptance Scenarios**:

1. **Given** no saved preference, **when** opening the HUD, **then** Basic is selected; the labeled toggle is keyboard accessible and its preference persists in this browser.
2. **Given** either mode, **when** selecting a critical finding, **then** severity, source age, permission limits and approval requirements remain visible.
3. **Given** Advanced, **when** changing to Basic, **then** authority, tool permissions, disclosure consent and execution behavior do not change. The canvas remains available in both modes.

### User Story 4 — Inspect Jev's exact advice (Priority: P1)

From an explicitly linked task/message, the operator opens the Science Officer view and sees what was asked, the typed answer, the evidence behind it and Border's interpretation.

**Independent Test**: Use synthetic bound assessments for Noul, Choice and Score, plus a linked reconsideration; include two authenticated sessions with different task ownership.

**Acceptance Scenarios**:

1. **Given** a trusted binding, **when** opening an assessment, **then** the exact dynamic question, answer type, option labels/rubric, returned probability/confidence, provider/model, evidence references and times, assessment time, cost and budget scope appear.
2. **Given** a Score answer, **when** displaying it, **then** rubric position and confidence are separately labeled; neither becomes a network-health percentage.
3. **Given** Border-authored influence, **when** opening Summary, **then** `supported`, `challenged`, `changed` or `unavailable` and the explanation are distinct from Jev's answer. Missing interpretation reads “not recorded”; the UI does not infer it from agreement.
4. **Given** one linked reconsideration, **when** comparing, **then** original and reconsidered questions, evidence, answers and Border interpretations remain visible together. No automatic second reconsideration or paid evaluation occurs.
5. **Given** an old/imported/unbound message or another session's assessment ID, **when** requesting detail, **then** no private detail is returned. The UI reports unbound/unavailable; it never matches by timestamp or globally latest assessment.

### User Story 5 — Inspect the Risk, neighbours and mobile devices (Priority: P1)

The operator can filter and inspect execution members, advertised capabilities, eligibility, current work, trust and enforcement posture; browse external peers separately; and inspect mobile edge availability and capabilities.

**Independent Test**: A synthetic mixed deployment has two same-named peers with different identities, a stale member, a disconnected phone, disabled capture capabilities and Jev enabled.

**Acceptance Scenarios**:

1. **Given** identical display names, **when** viewing entities, **then** stable identity and scope disambiguate them across table, detail and graph.
2. **Given** an external peer's advertised capability, **when** inspecting it, **then** the HUD distinguishes advertised, authorized, reachable and executed; no private remote topology is inferred.
3. **Given** a phone, **when** inspecting it, **then** last-seen/transport and advertised capabilities are shown with age. Disconnected is not unenrolled; disabled camera is not a failed capture.
4. **Given** an operation such as delegation, notification, capture or approval, **when** initiating it, **then** existing authenticated routing, consent and approval gates apply. Merely viewing the dashboard causes none of these actions.

### User Story 6 — Find all NetClaw operational surfaces (Priority: P2)

The operator finds network evidence, telemetry, routing/topology, security, incidents/changes, integrations/skills, RAG, memory, GCF/context efficiency, usage/budgets, Zoom and audit/report artifacts through a searchable navigation and capability catalogue.

**Independent Test**: Reconcile navigation against existing routes/panels and the installed capability catalogue; test available, disabled, not installed and unavailable sources.

**Acceptance Scenarios**:

1. **Given** a capability exists, **when** searching for it, **then** its category, owner, setup/availability and supported entry point are discoverable without needing a 3D node.
2. **Given** no structured feed exists, **when** opening that surface, **then** it provides an honest availability explanation and a supported scoped investigation path; it never renders fabricated metrics or a decorative working control.
3. **Given** GCF or usage data, **when** displaying it, **then** measured characters, estimated tokens, actual provider usage and priced cost are labeled separately.
4. **Given** RAG, memory or Zoom evidence, **when** attaching it to an investigation, **then** source and access scope survive; historical context is not presented as current device state.

### User Story 7 — Explore relationships in Three.js (Priority: P2)

An operator may switch a relationship view between a table/2D representation and Three.js to understand RISK membership, external federation or a sourced network path/topology.

**Independent Test**: Select the same entity in a table and graph, lose WebGL, and continue the investigation.

**Acceptance Scenarios**:

1. **Given** a graph, **when** selecting a node or edge, **then** its canonical detail panel opens with the same identity, source and timestamp as the table.
2. **Given** a capabilities graph and a physical network graph, **when** switching between them, **then** their meaning is explicit; federation links are never labeled physical links.
3. **Given** no WebGL, reduced motion or a small screen, **when** using the HUD, **then** tables, chat, canvas, evidence and approvals remain accessible. 3D loads on demand and pauses while hidden.

## Edge Cases

Empty successful response versus source failure; stale/future-dated evidence; partial fleet results; disconnected gateway and labeled heuristic fallback; duplicate names; unknown roles; no federation; no Jev; exhausted budget; redacted evidence; expired task access; malicious peer/question labels; aborted or out-of-order requests; IndexedDB unavailable/quota-full; imported sessions; multiple tabs; 320px screen; 200% zoom; WebGL context loss; large graphs; missing member enforcement controls. None may silently report health or authority that was not observed.

## Requirements

### Functional Requirements

- **FR-001**: Preserve Adam's canvas entry point, storage, licensing/attribution, conversation behavior and all capabilities enumerated in US1. No replacement with a linear chat drawer.
- **FR-002**: Provide a panel-first Overview and persistent access to Border chat and Canvas; preserve investigation context across navigation.
- **FR-003**: Provide persistent Basic/Advanced presentation modes with identical authorization and safety semantics.
- **FR-004**: Support standalone, Border, member, iN2N, eN2N and mixed deployments without assuming any optional component exists.
- **FR-005**: Keep members, mobile edges, external neighbours and advisors distinct in identity, counts, authority and graph semantics.
- **FR-006**: Every operational value must identify source/scope and freshness; unknown, empty, stale, denied, disabled and failed must remain distinguishable.
- **FR-007**: Provide detailed task-bound Jev views, typed semantics and original/reconsideration comparison as US4 defines.
- **FR-008**: Authorize assessment access server-side against authenticated principal/session/task/message ownership; browser IDs, local-origin access and model prose alone are insufficient proof.
- **FR-009**: Preserve existing MCP routing, ITSM, GAIT, disclosure, spending and mobile consent gates; Basic/Advanced cannot grant authority.
- **FR-010**: Cover the navigation/capability inventory in [workflows.md](workflows.md), preserving existing supported controls and clearly marking feed gaps.
- **FR-011**: Use optional Three.js views backed by the same normalized records as tables, with a usable non-WebGL path.
- **FR-012**: Provide keyboard navigation, visible focus, labeled statuses, responsive panels, reduced motion and recovery from isolated source failures.
- **FR-013**: Preserve local-origin/host access restrictions, sanitize untrusted content, prevent cross-session detail/WS/history disclosure and keep provider secrets server-side.
- **FR-014**: Retain compatible pre-127 canvas import/export and saved sessions; any additive migration must be versioned, recoverable and tested against real old-format synthetic fixtures.
- **FR-015**: Background reads and rendering must never trigger paid Jev inference, device mutations, ticket creation or external communications.

### Key Entities

Installation scope; principal/session; canvas node/message; originating task; entity/capability; sourced observation; assessment reference and typed assessment; Border influence; graph relation; browser presentation preference. See [data-model.md](data-model.md).

## Success Criteria

- **SC-001**: All pre-127 canvas preservation scenarios pass before release; no lost messages, relationships, attachments or saved sessions in the compatibility suite.
- **SC-002**: Every workflow in the coverage matrix has a working entry point and a tested available/unavailable presentation.
- **SC-003**: All cross-principal/session/task, forged/imported reference and late-response tests deny disclosure; zero paid evaluations occur in dashboard read tests.
- **SC-004**: Each deployment fixture passes in Basic and Advanced with correct entity counts and no optional-service dependency.
- **SC-005**: Core journeys work with keyboard only, reduced motion, WebGL disabled and at 320/768/1440px widths; no page-level horizontal overflow outside intentional canvas/table scrollers.
- **SC-006**: At 200 entities and 1,000 relations, fixture-based panel selection and mode changes respond within 200ms p95 on the recorded reference machine; initial usable dashboard within 2 seconds excluding data-source wait. Above this scale, paginate/filter and label graph limits explicitly.
- **SC-007**: Existing HUD tests/build pass alongside new acceptance tests. macOS, native Linux and Windows-browser→WSL acceptance are recorded separately; fixture evidence is never labeled live-host verification.

## Assumptions and Scope

Basic is the first-run default. Existing React/Vite/Express/Three.js stack remains. Canvas remains a first-class full workspace, with an optional adjacent dashboard inspector; its direct `canvas.html` route survives. Preference and canvas sessions remain local to the browser unless a separate authenticated sync feature is specified.

Mobile means both responsive HUD access and visibility into enrolled NetClaw Mobile/edge devices; this spec does not rewrite the native app or open a public HUD listener. Multi-operator tenancy and new federation protocols are not introduced. The task-scoped Jev mediation is required, even for the local single-operator deployment. The common upgrade utility remains a separate future spec.

## User refinement — 2026-09-28

Name the preserved workspace **Canvas** in navigation and controls (no personal
view label). RAG must be directly accessible, with uploads, ingestion state,
collection retrieval and cited evidence handoff. Add a Configuration destination
for .env keys/presence and related configuration paths; never expose credential
values. Continue verification and show the local result before any push.

## User refinement — Claw introspection, Tokenomics, docs and logs

Provide per-Claw MCP/tool drill-down and reported model identity. Separate configured
and advertised metadata from actual usage/authority. Add Tokenomics with recorded
tokens/cost, estimates, budgets and missing-source coverage; Documentation with
README/guides, CLI commands/flags/options/modalities, MCP source references, and a
HUD OpenAPI artifact. Include Sean Mahoney's README-linked community guide panel.
Add direct bounded service logs, service/severity/text filters, copyable logging
commands, and logging-script documentation. Replace the old HUD SSH migration
callout in README with the new HUD entry; retain runtime access controls.


Additional user refinement: early LAB/production summary, dedicated DefenseClaw
and OpenShell panels, settings/guides/log links. Display supported ITSM LAB bypass
independently from N2N testing/production and independent from observed containment.
Current iN2N member confinement is systemd-based; do not mislabel it as OpenShell.
