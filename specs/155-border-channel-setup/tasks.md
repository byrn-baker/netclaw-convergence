# Tasks: Complete Comms Setup

**Input:** [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/comms-setup.md](contracts/comms-setup.md), [research.md](research.md).

Tasks are complete only when their stated evidence exists. Provider/platform qualification cannot be replaced by fixtures. No task authorizes device/model operations or external communication without the required scoped review.

## Phase 1 — SDD and baseline

- [x] T001 Reconcile pinned compatibility, native IDs and capability kinds for every entry in `specs/155-border-channel-setup/channel-inventory.json`; retain all current documentation entries and explicit source evidence.
- [x] T002 Complete cross-artifact analysis and requirement coverage in `specs/155-border-channel-setup/analysis.md`, resolving material findings before implementation.
- [x] T003 Record source/runtime baseline, local-only qualification scope and available account prerequisites in `specs/155-border-channel-setup/verification.md`; keep credential values outside artifacts.

## Phase 2 — Shared contracts

- [x] T004 Add catalog/schema and legacy-plan contract tests in `tests/test_setup_comms_catalog.py`, including canonical/native ID separation and full inventory coverage.
- [x] T005 Implement validated Comms manifest/schema in `config/components/comms.json` and `config/components/comms.schema.json`, plus `scripts/check-comms-catalog.py`; preserve explicit incomplete/version/host/role dispositions.
- [x] T006 Integrate authoritative Comms channel settings/choices into `scripts/build-catalog.py`, `config/components/schema.json` and generated `config/components/catalog.json` without losing existing component/skill metadata.
- [x] T007 Extend additive plan capacities/placement/verification contracts and validation in `config/claw-plan.schema.json` and `scripts/lib/setup_plan.py`, preserving old plans and member/Border authority.
- [x] T008 Implement Comms resolver and owner-bound field/access helpers in `scripts/lib/setup_comms.py`, including independent selections and restrictive defaults.
- [x] T009 Bind Comms catalog/adapter identities into reviews and deterministic effect ordering in `scripts/lib/setup_engine.py` and `scripts/lib/setup_plan.py`; stop downstream activation after unsettled required setup.

## Phase 3 — US1: complete discovery (P1)

**Goal:** every documented option is discoverable with its runtime, kind, owner and honest disposition.
**Independent check:** compare local wizard/CLI/assistant discovery against the full inventory with no credentials or network activity.

- [x] T010 [US1] Add Comms discovery/selection contract tests in `extensions/netclaw-vscode/test/setup-comms.test.mjs`, including Twilio/Zoom search and role/version distinctions.
- [x] T011 [US1] Implement typed frontend Comms data/resolution in `extensions/netclaw-vscode/src/setup/comms.ts` and `extensions/netclaw-vscode/src/setup/data.ts`.
- [x] T012 [US1] Add searchable Comms cards and multi-channel selection to `extensions/netclaw-vscode/resources/setup-wizard.js`, `setup-wizard.css` and `src/views/setup-wizard.ts`; preserve retained settings and explicit None.
- [x] T013 [US1] Expose complete Comms metadata through `scripts/lib/setup_cli.py` and existing setup assistant catalog/broker interfaces in `extensions/netclaw-vscode/src/setup/`; discovery must remain inert.

## Phase 4 — US2: guided onboarding (P1)

**Goal:** every supported selected channel has a real typed setup or bounded native handoff with verified owned configuration.
**Independent check:** controlled contracts exercise all catalog entries and actual packaged native helpers without messages, model turns or account provisioning.

- [x] T014 [US2] Add configuration merge, native-scope, wrong-owner and interrupted-write tests in `tests/test_setup_comms_onboarding.py`.
- [x] T015 [US2] Implement secure typed configuration/access forms and per-channel writes/readback in `scripts/lib/setup_comms.py`, `scripts/lib/setup_harness.py` and `scripts/lib/setup_deploy.py`; preserve provider/MCP/other-channel revisions.
- [x] T016 [US2] Add version/source-bound Hermes selected-platform helper in `installer/native-comms/hermes_setup.py`; preserve manifest trust/version gates, restrict plugin loading and implement field fallbacks where native setup only prints guidance.
- [x] T017 [US2] Add reproducible pinned OpenClaw selected-adapter helper/build contract in `installer/native-comms/openclaw/`; qualify explicit plugin loading, masked prompts, revision-aware writes and bounded post-write hooks against the packaged artifact.
- [x] T018 [US2] Integrate exact Comms native-effect authority with `scripts/lib/setup_transport.py`, `scripts/lib/setup_components.py` and `extensions/netclaw-vscode/src/setup/native-terminal.ts`; no general command execution or secret argv.
- [x] T019 [US2] Complete onboarding/dependency/readback contracts for all compatible selectable channel paths and selected NetClaw Comms components in `config/components/comms.json`; validate each path with contract fixtures and preserve evidence-backed baseline restrictions.
- [x] T020 [US2] Add runtime-specific account/app preparation, permissions, callback and access guidance to `docs/COMMS-SETUP.md` and link it from wizard/CLI/native handoffs; include Discord and Teams credential-acquisition steps.

## Phase 5 — US3: owned services and access (P1)

**Goal:** selected channels use the correct owned messaging process with reviewed access and exposure.
**Independent check:** isolated service identities, fresh status evidence, ownership conflicts and rejected activation; neighboring runtimes unchanged.

- [x] T021 [US3] Add Hermes messaging-role, status-freshness, conflict and cleanup cases in `tests/test_setup_comms_services.py` and `tests/test_setup_service_binding.py`.
- [x] T022 [US3] Implement Hermes foreground messaging gateway dispatch/ownership in `scripts/lib/setup_risk.py`, `scripts/setup-service.py` and existing service binding/cleanup helpers; keep HUD/companion health separate.
- [x] T023 [US3] Implement selected-runtime configuration/authentication/transport observation in `scripts/lib/setup_comms.py` and `scripts/lib/setup_verify.py`, rejecting stale PID/heartbeat/config-only status as transport proof.
- [x] T024 [US3] Bind effective allowlists/pairing/mention policy, dependency sources and activation effects into native review in `scripts/lib/setup_plan.py` and `extensions/netclaw-vscode/src/setup/review.ts`; stop unbounded startup behavior.
- [x] T025 [US3] Cover owned public endpoint prerequisites, plugin/host incompatibilities and duplicate account consumers in `tests/test_setup_comms_services.py`; no silent tunnel, policy weakening or foreign-process adoption.

## Phase 6 — US4: verification and evidence (P1)

**Goal:** configuration, authentication, transport, inbound and outbound outcomes remain separate and attributable.
**Independent check:** select actual wizard test requests, cancel sends, lose receipts, reorder callbacks and export reports without private values.

- [x] T026 [US4] Add per-channel evidence and consent/replay/privacy tests in `tests/test_setup_comms_verification.py` and `tests/test_setup_live.py`.
- [x] T027 [US4] Materialize account/destination/direction requests in the wizard and CLI using `src/views/setup-wizard.ts`, `src/setup/comms.ts` and `scripts/lib/setup_cli.py`; retain imported legacy requests.
- [x] T028 [US4] Extend fixed destination/send/receipt contracts in `scripts/lib/setup_channels.py` and `scripts/lib/setup_live.py`; reject unsupported directions and preserve exact native consent and unknown-outcome pause.
- [x] T029 [US4] Add controlled inbound/auth/transport verification contracts without implicit agent turns in `scripts/lib/setup_comms.py`; expose unavailable safe checks as unverified.
- [x] T030 [US4] Implement Twilio submission-versus-delivery evidence, signature requirements and duplicate/out-of-order handling in `scripts/lib/setup_comms.py` and `tests/test_setup_comms_verification.py`.
- [x] T031 [US4] Extend structural Claw Report projection and frontend rendering in `scripts/lib/setup_report.py` and `extensions/netclaw-vscode/src/setup/reports.ts`; exclude secrets, raw outputs and unreviewed identifiers.

## Phase 7 — US6: existing Twilio/Zoom Comms capabilities (P1)

**Goal:** make existing tools and meeting/voice paths available with correct ownership and installation contracts.
**Independent check:** both-runtime role matrix, explicit member selection, inert MCP discovery, private bindings and no external activation.

- [x] T032 [US6] Add explicit Comms member/component selection to catalog generation, wizard and CLI in `scripts/build-catalog.py`, `src/setup/comms.ts`, `src/views/setup-wizard.ts` and `scripts/lib/setup_cli.py`; retain Border restrictions and independent credentials.
- [x] T033 [US6] Add transient inert Zoom discovery mode and refusal of effectful calls in `mcp-servers/zoom-rtms-mcp/server.py`; propagate it through both runtime discovery adapters without persisting it as active configuration.
- [x] T034 [US6] Add same-plan Zoom owner/Border port and dedicated-secret binding through `scripts/lib/setup_comms.py` and owned deployment writers; reject foreign/remote placements, collisions and partial-write activation.
- [x] T035 [US6] Verify actual single-process Zoom tool/background lifetime and distinguish configuration from active ingress in `tests/test_setup_comms_zoom.py` and `specs/155-border-channel-setup/verification.md`; do not create two unrelated meeting registries.
- [x] T036 [US6] Implement the pinned private-environment Twilio core launcher and lockfile in `mcp-servers/twilio-env-mcp/`, preserving current service/tag filters and excluding OS-argument credentials or first-use downloads.
- [x] T037 [US6] Integrate managed Twilio installation/registration/discovery in `scripts/lib/install-steps.sh`, `scripts/lib/setup_components.py`, `scripts/lib/setup_deploy.py` and affected catalog/config metadata; preserve existing unrelated registrations.
- [x] T038 [US6] Add managed inbound-voice routing/fallback and memory ownership guards in `mcp-servers/twilio-voice-mcp/webhook_server.py`; retain legacy behavior outside managed setup and do not assert unsupported Hermes voice compatibility.
- [x] T039 [US6] Add subprocess-level Twilio secret/transport tests and Zoom no-listener/no-capture tests in `tests/test_setup_comms_tools.py`; verify role isolation and startup effects across both harnesses.
- [x] T040 [US6] Document native SMS/runtime telephony/NetClaw MCP distinctions, Zoom conditional prerequisites and owned placement in `docs/COMMS-SETUP.md` and the affected Twilio/Zoom README/skill files.

## Phase 8 — US5: parity, recovery and accessibility (P2)

**Goal:** all frontends draft equivalent plans and interrupted setup resumes without duplicate effects or lost selections.
**Independent check:** frontend parity, reload/cancel/resume, changed reviews, legacy plans and keyboard/theme/zoom behavior.

- [x] T041 [US5] Extend interrupted Comms effect observation/recovery and owned cleanup in `scripts/lib/setup_observation.py`, `scripts/lib/setup_engine.py` and cleanup helpers with tests in `tests/test_setup_comms_recovery.py`.
- [x] T042 [US5] Preserve legacy no-channel/single-channel plans and retained credentials through selection/reload in `tests/test_setup_plan.py` and `extensions/netclaw-vscode/test/setup-comms.test.mjs`.
- [x] T043 [US5] Align assistant drafting/native authority and deployment skill guidance in `extensions/netclaw-vscode/src/setup/` and `installer/assistant-skills/netclaw-install/SKILL.md`; never expose secret content to the assistant.
- [x] T044 [US5] Verify keyboard, light/dark/high-contrast and zoom behavior in an isolated editor using `extensions/netclaw-vscode/scripts/editor.mjs` and record actual results in `specs/155-border-channel-setup/verification.md`.

## Phase 9 — Integration and closure

- [x] T045 Update coherent setup documentation/examples in `README.md`, `SOUL.md`, `TOOLS.md`, `.env.example`, `docs/GETTING-STARTED-VSCODE.md` and extension walkthroughs; keep existing operational tool counts accurate.
- [x] T046 Run applicable catalog/schema/security checks, Python setup suites, affected Twilio/Zoom regressions and extension typecheck/build/tests; record exact results in `specs/155-border-channel-setup/verification.md`.
- [x] T047 Perform actual isolated Mac installer acceptance for both runtimes, multiple channels, Comms role placement, cancel/resume and preserved neighboring state; record evidence in `specs/155-border-channel-setup/verification.md`.
- [ ] T048 Prepare and execute the scoped WSL installer qualification handoff, preserving the running sandbox, with results in `specs/155-border-channel-setup/wsl-handoff.md` and `verification.md`. **Partial execution 2026-10-25:** actual both-runtime acquisition/configuration, inert discovery, access refusal and recovery checks recorded; remote editor and isolated-manager acceptance remain open.
- [x] T049 Reconcile every inventory entry and supported setup path against actual local/provider/platform evidence in `specs/155-border-channel-setup/coverage.json`; missing accounts and untested claims remain open, never simulated live passes.
- [x] T050 Complete final cross-artifact review and source-change audit, draft the milestone article in `specs/155-border-channel-setup/milestone-draft.md`, and record GAIT/session closure without publishing or claiming completion prematurely.

## Dependencies and execution

T001–T003 precede implementation. T004–T009 establish shared contracts. US1 discovery and US2 onboarding use those contracts; US3 depends on complete selected configuration; US4 depends on truthful service observation. US6 reuses the shared contracts and existing role rules. US5 then checks parity/recovery across the integrated feature. Final acceptance requires all relevant implementation tasks and checks.

Independent work can be parallelized only on disjoint files after dependencies settle: catalog fixture design versus frontend fixture design; provider preparation documentation versus service tests; subprocess Twilio tests versus Zoom inert-discovery tests. Shared engine/catalog/wizard edits remain sequential. Research delegation is allowed by the planning skill; implementation ownership remains explicit.

## Requirement coverage

| Requirements | Tasks |
| --- | --- |
| FR-001–FR-006 | T001, T004–T013, T019 |
| FR-007–FR-009 | T014–T020, T024, T036–T040 |
| FR-010–FR-016 | T007–T009, T021–T025, T032–T039 |
| FR-017–FR-021 | T026–T031, T047–T049 |
| FR-022–FR-024 | T041–T044, T013, T027 |
| FR-025–FR-026 | T004, T014, T021, T026, T039, T046–T050 |
| FR-027–FR-028 | T015, T019, T026, T030, T036–T040 |
| FR-029–FR-032 | T010–T013, T032–T040 |
| SC-001–SC-009 | T004, T010, T014, T021, T026, T039, T042, T044, T046–T050 |

## Implementation strategy

Deliver complete contract-tested slices in dependency order and mark tasks only after evidence. A discovery-only milestone is useful but does not satisfy onboarding/activation requirements. Native helper packaging and actual MCP lifetime are explicit implementation gates, not reasons to weaken the spec. External/provider/platform qualification remains visible until performed with the required identities and exact consent.


## Mac reconciliation closure — 2026-10-25

T047 and T050 are complete for the installer-only scope documented in the Mac
runtime/editor/preservation evidence. Actual editor drafting/reload and direct
redacted report inspection are distinct from controlled engine review authority;
the product report-button/export-dialog success path was not executed against the
isolated journals. Positive service fixtures retain synthetic manager/provider
boundaries. No provider readiness, live deployment or release is implied.

**49/50 tasks complete. T048 remains open** for genuine WSL remote-editor and
isolated-manager acceptance and the documented remaining WSL fixtures. Six WSL
extension failures remain failures. Mac results cannot close these gates;
`coverage.json` retains overall `complete: false`.
