# Tasks: NetClaw extension experience

Input: spec.md, plan.md, research.md, data-model.md and contracts/. All six stories are required; MVP is an internal verification checkpoint only. Tests are required by SC-001–009. No packaging/push/deployment/publication.

## Phase 1: Setup

- [x] T001 Verify supported toolchain, ignore rules and isolated fixture boundaries; record baseline in specs/151-extension-experience/verification.md (FR-026, SC-008).
- [x] T002 Complete cross-artifact analysis and resolve every finding in specs/151-extension-experience/analysis.md before source changes (FR-025).

## Phase 2: Foundation

- [x] T003 Add shared semantic shell and fixed contextual action routing in extensions/netclaw-vscode/src/webview/shell.ts, panel.ts and bridge.ts; retain trust/identity/message fences and bound the testbed-only message cap at1MiB (FR-001, FR-024).
- [x] T004 Verify shell escaping, stale view and allowlist boundaries in extensions/netclaw-vscode/test/experience.test.mjs (FR-024).

## Phase 3: US1 — Cohesive workbench (P1)

Independent test: every existing domain/specialized view has readable primary structure with theme-aware controls; search/state and existing workflows still function.

- [x] T005 [P] [US1] Add presenter/DOM fixtures for all22 domains, direct variants, zero/false/unknown, escaped content and500-record search in extensions/netclaw-vscode/test/experience.test.mjs (FR-003, SC-001, SC-006).
- [x] T006 [US1] Implement explicit domain presenters, provenance, overview actions and bounded source disclosure in extensions/netclaw-vscode/resources/presenters.js and data.js (FR-002, FR-003, FR-004, FR-010).
- [x] T007 [US1] Implement shared cards, typography, form/help/status states, responsive wrapping, active theme, high contrast and reduced motion in extensions/netclaw-vscode/resources/workbench.css (FR-001, FR-002, FR-006, FR-007, FR-008, FR-009).
- [x] T008 [US1] Apply semantic composition and labels to Chat/RAG/Canvas/Avatar without changing ownership behavior in extensions/netclaw-vscode/src/views/ and resources/chat.js, resources/rag.js, webview/canvas.js (FR-001, FR-006, FR-023).

## Phase 4: US2 — Connection setup (P1)

Independent test: first-time fixture connection explains nickname/API locality and verifies the intended identity.

- [x] T009 [US2] Improve connection prompts, examples, verified-status labels and navigation copy in extensions/netclaw-vscode/src/extension.ts and src/client/domains.ts (FR-005, FR-010, SC-002).
- [x] T010 [US2] Exercise synthetic new connection and stale/unreachable profile behavior in extensions/netclaw-vscode/test/editor.cjs and existing connection tests (FR-005, FR-024, SC-002).

## Phase 5: US3 — Testbed management (P1)

Independent test: isolated device CRUD, YAML/JSON/CSV import/export and reviewed restore preserve unrelated data and secrets, reject stale edits and respect sessions/consent.

- [x] T011 [P] [US3] Add document contract tests for CRUD, masking/token attacks, bounded parsing, CST/alias preservation, multi-connection CSV, all formats, mode0600 exports and backup/write fault recovery in ui/netclaw-visual/test/testbed-document.mjs (FR-011, FR-012, FR-013, FR-014, SC-003).
- [x] T012 [US3] Implement inert validation, safe projection, masked drafts and deterministic guided/document/import preparation in ui/netclaw-visual/testbed-document.js (FR-011, FR-013, FR-014).
- [x] T013 [US3] Implement revision/digest commit, private backup/export/restore and actual readback in ui/netclaw-visual/testbed-document.js (FR-012, FR-013, FR-014).
- [x] T014 [US3] Mount installation-bound routes with active-session refusal and affected/global consent/login revocation in ui/netclaw-visual/server.js; extend HTTP fixture tests (FR-012, FR-015, FR-024).
- [x] T015 [US3] Add reviewed bound host controller, native import/export destinations and older-HUD fallback in extensions/netclaw-vscode/src/views/testbed.ts (FR-011, FR-012, FR-013, FR-024).
- [x] T016 [US3] Build device cards, guided forms, advanced editor, previews and draft-mode protection in extensions/netclaw-vscode/resources/testbed.js; route commands in src/extension.ts (FR-006, FR-011, FR-014).
- [x] T017 [US3] Verify cancel/stale/identity invalidation, mode switch and save failure handling in extensions/netclaw-vscode/test/testbed-view.test.mjs and test/real-hud.test.mjs (FR-012, FR-015, FR-024, SC-003).

## Phase 6: US4 — Per-MCP setup (P1)

Independent test: every known card opens scoped fields within two interactions; reviewed supported operations report actual verified, failed or unknown outcomes against isolated targets.

- [x] T018 [P] [US4] Add field/alias/keep-replace-clear/revision/preservation/secret tests in ui/netclaw-visual/test/mcp-configuration.mjs (FR-016, FR-017, FR-018, FR-019).
- [x] T019 [US4] Implement explicit metadata joins and scoped revision-aware env save with private baseline/value verification in ui/netclaw-visual/mcp-configuration.js and server.js; reconcile duplicate catc fields (FR-016, FR-017, FR-018, FR-019).
- [x] T020 [US4] Implement integration-card actions, scoped form/help/shared-field review and truthful state display in extensions/netclaw-vscode/src/views/mcp.ts and resources/mcp.js (FR-016, FR-017, FR-018, FR-019).
- [x] T021 [US4] Add setup preparation/execution acceptance for target/helper/revision fences, cancellation, failures and interrupted evidence in extensions/netclaw-vscode/test/setup.test.mjs (FR-020, FR-024, FR-027).
- [x] T022 [US4] Implement fixed operation coordinator with binding, preconditions, baseline, serialization, sanitized progress and no-replay evidence in extensions/netclaw-vscode/src/client/setup.ts (FR-020, FR-024, FR-027).
- [x] T023 [US4] Wire reviewed staging/direct execution and supported-helper postconditions in extensions/netclaw-vscode/src/views/setup.ts, add expected config/sidecar revision checks to scripts/install-mcp-config.py and its tests; reuse existing scripts/setup-pyats-runtime.py, scripts/setup-gait-runtime.py, scripts/install-mcp-config.py and scripts/federation-control.py (FR-020, FR-027).
- [x] T024 [US4] Verify enabled install/register/restart helpers on isolated owned targets and document explicit unavailable actions/platform limits in specs/151-extension-experience/verification.md (SC-004, FR-027).

## Phase 7: US5 — Purposeful visuals (P2)

Independent test: bundled art fits active themes; BGP graph selection/navigation works with complete text fallback and releases resources.

- [x] T025 [P] [US5] Generate and inspect public-only decorative artwork; store selected assets and prompt/provenance in extensions/netclaw-vscode/resources/brand/ (FR-022).
- [x] T026 [US5] Add truthful graph adapter tests and fallback/lifecycle coverage in extensions/netclaw-vscode/test/topology.test.mjs (FR-021).
- [x] T027 [US5] Implement local Three.js session graph, semantic selection, zoom/reset, theme/resize/hide/context-loss/dispose in extensions/netclaw-vscode/webview/topology.js and build.mjs (FR-009, FR-021).
- [x] T028 [US5] Integrate artwork/graph with shared views and verify both themes without resetting filters or drafts in extensions/netclaw-vscode/src/webview/bridge.ts and resources/workbench.css (FR-008, FR-021, FR-022).

## Phase 8: Validation and local handoff

- [x] T029 Run targeted HUD/extension/installer regressions and fix all implementation findings; record results in specs/151-extension-experience/verification.md (FR-023, SC-007).
- [x] T030 Review every domain and specialized view family in source-development VS Code; record state/theme/keyboard/zoom/width/reduced-motion matrix and500-record timing in specs/151-extension-experience/verification.md (SC-001, SC-005, SC-006).
- [x] T031 Update root README.md, extensions/netclaw-vscode/README.md, SOUL.md, TOOLS.md and local milestone draft; run catalog coverage, documenting unchanged integration/env scope (FR-023, SC-008).
- [x] T032 Re-run cross-artifact analysis, resolve all findings, update specs/151-extension-experience/tasks.md and verification.md; launch local source preview and close GAIT/daily notes without packaging or external actions (FR-025, FR-026, SC-007, SC-008).

## Dependencies and parallel opportunities

T001–T002 precede all source changes. T003–T004 establish the shell. US1 and US2 precede integrated US3/US4; US3 API precedes its host controller; US4 metadata precedes form and runner wiring. US5 graph/art can proceed independently after foundation, but final integration follows US1. T029–T032 require every story complete. Tests precede corresponding implementation and must initially demonstrate the missing behavior.

Parallel examples: US1 presenter fixtures and CSS can be independent after shell; US2 copy and test fixture preparation use separate files; US3 pure service tests and host controller fixtures can be authored independently; US4 descriptor tests and pure setup tests are separate; US5 art and graph tests are separate. These are file-level opportunities, not permission to delegate agents. All shared-file edits remain sequential.

## Implementation strategy

Validate US1 as the first local visual checkpoint, then complete connection, testbed, per-MCP and visual stories with their independent acceptance. No reduced MVP substitutes for the full requested scope. Mark tasks complete only after implementation and applicable verification. Record platform limits honestly; keep all distribution actions held.

## Phase 9: Owner amendment — US6 security perimeter

- [x] T033 Update specification, clarification, upstream capability research, contract and analysis; resolve all amendment findings before source changes (FR-028–033, SC-009).
- [x] T034 Add fixed native CLI adapter and isolated tests for target/revision/capability fences, DefenseClaw scoped rule/settings changes, OpenShell network policy preservation, redaction, concurrency, failure/unknown evidence and readback verification (FR-028–033).
- [x] T035 Add native binding/review controller and responsive security pages with status, logs, rule controls and explicit unsupported states; route OpenShell and DefenseClaw navigation (FR-028–033).
- [x] T036 Run both-page DOM/editor acceptance, regression checks and final analysis; refresh documentation/evidence/preview and audit without distribution actions (SC-009, SC-007–008).

Dependencies: T033 → T034 → T035 → T036. Original T032 handoff remains open until this amendment is included.
