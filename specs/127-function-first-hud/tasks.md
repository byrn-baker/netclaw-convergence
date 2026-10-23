# Tasks: Function-first HUD

Status: ratified 2026-09-28; local implementation and automated verification underway. Browser/live-host gates remain blocked in this session; no push authorized before user review. Execute dependency order. No task implies permission for network changes or external publication.

## Phase 1 — Preserve and establish the baseline

- [x] T001 Record spec ratification and the final acceptance scope before runtime implementation.
- [x] T002 Inventory existing routes, panels, settings actions, source producers and deployment shapes; reconcile against workflows.md (FR-004/010).
- [ ] T003 Capture synthetic pre-127 canvas fixtures and browser preservation journeys: branches, synthesis, tabs, attachments, layout, session library, import/export, undo/redo and pending request/save behavior (FR-001/014).
- [x] T004 Run existing HUD tests/build; record supported runtime and source revision without changing dependencies unnecessarily.

## Phase 2 — Dashboard and presentation modes

- [x] T005 Implement source-qualified entities and independent availability/freshness adapters with malformed/partial/stale fixtures (FR-005/006).
- [x] T006 Add panel-first shell, navigation/search, Basic/Advanced preference and persistent Border chat/Canvas access (FR-002/003/010).
- [ ] T007 Preserve active canvas/draft/request across navigation; add selected-evidence handoff without automatic send; rerun T003 (FR-001/002/014/015).
- [ ] T008 Implement Overview and standalone/Border/member/eN2N mixed fixture coverage with honest not-configured and denied states (FR-004/006).

## Phase 3 — Trusted Jev integration

- [ ] T009 Implement/prove authenticated session bootstrap and gateway-originating task/message binding; document lifetime, revocation, concurrent-task isolation and budget identity (FR-008/013).
- [x] T010 Implement scoped read mediation through existing Jev MCP; allowlist detail fields, bound reads, safe audit and no-store; prohibit global ledger reads (FR-007/008/015). Depends on T009.
- [ ] T011 Test forged/imported/foreign/expired bindings, cross-task reconsideration, global WS/history leakage, stale responses and zero paid evaluations (FR-008/013/015). Depends on T010.
- [x] T012 Add exact Noul/Choice/Score question/result, evidence/model/time/cost and Border influence views within Adam's context/source/summary flow (FR-007). Depends on T011.
- [x] T013 Add original/one-reconsideration comparison and unbound/disabled/budget/unavailable states; preserve old sessions and separate advisor counts (FR-005/007/014).

## Phase 4 — Operational coverage

- [x] T014 Implement RISK, neighbours and mobile views with stable IDs, capabilities, authority, posture and source freshness; preserve approval/capture/notification gates (FR-004/005/009).
- [x] T015 Reconcile installed capability search and network/routing/telemetry/security evidence entry points against producers; implement structured adapters only where proven (FR-006/010).
- [x] T016 Preserve RAG, Zoom, existing settings/utilities; expose memory, GCF, usage, audit/report and incident/change entry points with explicit feed gaps (FR-009/010/013).
- [ ] T017 Complete workflow matrix checks: every destination has a supported action/read path or precise availability explanation, with no fabricated metrics or dead controls (FR-010/015).

## Phase 5 — Three.js and accessible rendering

- [x] T018 Add lazy optional RISK/federation and sourced topology/path views using the same identities/details as tables (FR-011).
- [ ] T019 Verify no-WebGL, context loss, reduced motion, hidden-view pause/disposal, graph limits and keyboard/table alternatives (FR-011/012).
- [ ] T020 Browser-check 320/768/1440px, 200% zoom, focus/back navigation and mobile touch; measure specified fixture performance (FR-012).

## Phase 6 — Acceptance and handoff

- [ ] T021 Run full HUD regression/build plus Jev/federation tests affected by the final implementation. Verify old sessions survive upgrade and recovery (FR-001–015).
- [ ] T022 Record macOS, native Linux and Windows-browser→WSL checks independently; distinguish real mobile/provider acceptance from fixtures.
- [ ] T023 Update README/TOOLS/HUD guide and applicable installer/config/env docs; verify catalogue/spec coherence; draft milestone blog locally.
- [ ] T024 Complete acceptance traceability, unresolved-gap report, daily memory and GAIT summary/log. Do not mark feature complete while required checks remain pending.

## Dependencies

T001–004 precede runtime changes. T005–008 establish shared models/shell. T009–011 are hard prerequisites for private Jev detail; T012–013 depend on them. T014–017 complete coverage before T018–020 optional graph polish. T021–024 close the release gates. Canvas regression is required after every phase touching its behavior.

## 2026-09-28 acceptance notes

T003 has an actual production serializer/loader fixture round trip and session-gate
regressions, but its browser journey is still pending. T007 has additive same-origin
draft handoff and mounted iframe preservation; interactive browser confirmation remains.
T008 has pure model and mixed-deployment DOM coverage, not every deployed host.
T009 implements cookie-owned threads and exact gateway transcript proofs; actual
gateway/MCP envelope acceptance is pending (CLI wrappers intentionally remain unbound).
T011 passes direct route authorization tests, but real HTTP/WS acceptance cannot run
because the sandbox denies local listeners. T017 requires final browser coverage of
all retained classic controls. T019 has disposal/context-loss/table fallback code;
real WebGL verification is pending. T020 and T022 cannot be marked complete without
a browser and the respective hosts. T021 build/unit/DOM/stdio checks are recorded in
verification; two listener tests are still blocked. T023 documentation is updated
and a blog draft exists, with final coherence checks recorded separately. T024 remains
open until required acceptance is complete. No checkbox is a claim of live deployment.

## RAG / Configuration refinement

- [x] Add RAG to Basic/Advanced menus, upload form, polling ingestion inventory,
  collection retrieval and cited Canvas draft handoff; preserve replica provenance.
- [x] Add read-only Configuration inventory with full-value suppression and
  RAG/Jev/additional .env keys.
- [x] Rename dashboard labels to Canvas and test persistent real iframe identity,
  direct canvas.html link and Basic/Advanced navigation.
- [x] Test retrieval bounds, concurrency, backend failures, multipart upload UI,
  pending-vs-ready status and secret-free configuration projection.
- [ ] Live browser upload → indexing → retrieval → Canvas draft acceptance.
  Requires permitted local listener/browser and running RAG dependencies.


## Introspection / Tokenomics / Documentation / Logs refinement

- [x] Exact reported Claw MCP/tool/model inspectors; local runtime projection;
  authenticated member configuration inventory without changing authorization.
- [x] Tokenomics recorded usage/cost/cache breakdown, missing-data coverage,
  distinct local heuristic and Jev budgets.
- [x] Documentation index, safe reader/links, CLI/source declaration generator,
  MCP signatures, HUD OpenAPI route inventory, modalities, Sean's community panel.
- [x] Fixed-source Logs, bounded reads, redaction, filtering, refresh, commands,
  log evidence to Canvas, and logging guide/reference entries.
- [x] README introduction updated for new HUD and old SSH migration callout removed.
- [ ] Actual updated member reconnect/report + peer/runtime inventory acceptance.
- [ ] Live usage/log readers against each deployed host, visual/keyboard/touch review.

External CLI help/dynamic MCP tools/list and complete typed schemas for every legacy
HTTP payload are outside the generated static reference's completeness claim. All
static script entrypoints and registered HUD routes are indexed, with limitations
visible in the UI and artifacts. No executing API explorer or command runner added.

- [x] Overview LAB/production summary, Security destination, safe mode projection,
  separate DefenseClaw/OpenShell/confinement/audit panels and service log links.
- [x] Fixed read-only OpenShell probes; missing/stale production-control regression;
  security settings guide and corrected legacy .env.example confinement comment.
- [ ] Real DefenseClaw/OpenShell/runtime enforcement acceptance on supported hosts.
