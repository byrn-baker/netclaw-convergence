# Tasks: Dynamic pyATS testbeds

## Phase 1 — Specification and research

- [x] T001 Record upstream revision, actual tools and lifecycle research in specs/160-dynamic-pyats-testbeds/research.md.
- [x] T002 Define source, lifecycle and installer contracts in specs/160-dynamic-pyats-testbeds/contracts/managed-testbeds.md and data-model.md.

## Phase 2 — Shared foundation

- [x] T003 Add canonical source descriptors and fixture coverage in config/pyats-testbed-sources.json and tests/fixtures/pyats-testbeds/ (FR-004/SC-002).
- [x] T004 Add adversarial normalization tests in tests/test_pyats_testbeds.py for scope, freshness, partial pages, conflicts, credentials, console-only and OS ambiguity (FR-005/007/008/SC-004).
- [x] T005 Implement bounded pure normalization/policy helpers in scripts/lib/pyats_testbeds.py (FR-004/005/007/008).
- [x] T006 Update scripts/setup-pyats-runtime.py pin/verification and isolated rollback tests (FR-001).

## Phase 3 — US1: installer choice

Independent test: static/dynamic selected-claw flows, private env, exact review,
cancel/resume and static preservation in both terminal paths and VS Code.

- [x] T007 [US1] Add optional policy schema and semantic tests in config/claw-plan.schema.json and tests/test_setup_plan.py (FR-002/003).
- [x] T008 [US1] Implement policy validation/review/generated env in scripts/lib/setup_plan.py and setup_generated.py (FR-002/003/007).
- [x] T009 [US1] Preserve inventory ownership and skip dynamic placeholder in scripts/lib/setup_deploy.py and setup_effects.py; test isolation/recovery in tests/test_setup_deploy.py and test_setup_recovery.py (FR-003/007).
- [x] T010 [US1] Add terminal plan mode/source selection in scripts/lib/setup_cli.py and tests/test_setup_cli.py (FR-002/SC-001).
- [x] T011 [US1] Add selected-runtime mode/source configuration to scripts/setup.sh and static-safe install defaults in scripts/lib/install-steps.sh; test legacy terminal flow (FR-002/003).
- [x] T012 [US1] Add VS Code policy model, native mode/source picker, summaries and invalidation in extensions/netclaw-vscode/src/setup/ and src/views/setup-wizard.ts plus resources/setup-wizard.js (FR-002/007).
- [x] T013 [US1] Test VS Code controller cancel/import/reload/member separation in extensions/netclaw-vscode/test/ (SC-001).
- [x] T014 [US1] Make readiness, catalog and downstream static assumptions mode-aware in config/installer-access.json, scripts/installer-readiness.py, scripts/in2n-profiles.py and ui/netclaw-visual/mcp-configuration.js (FR-010).

## Phase 4 — US2: composed source inventory

Independent test: every named source fixture normalizes with source identity and
completeness; missing management facts never become a candidate.

- [x] T015 [US2] Register managed composition using official MCP in scripts/pyats-managed.py, invoking actual upstream fixed inline builder (FR-004/005/006).
- [x] T016 [US2] Cover source schema differences, scoped enrichment and cross-source collision rejection in tests/test_pyats_testbeds.py (SC-002/004).
- [x] T017 [US2] Document source MCP discovery, unsupported reader gaps and primary references in docs/DYNAMIC-TESTBEDS.md (FR-004/011).

## Phase 5 — US3: review and lifecycle

Independent test: actual managed MCP build/validate/activate/list and restart with
no TCP probes or device login; failed candidate preserves previous active state.

- [x] T018 [US3] Add lifecycle/credential/concurrency guard tests in tests/test_pyats_dynamic_runtime.py (FR-005/006/007/009).
- [x] T019 [US3] Implement immutable candidates, validation-gated activation, safe inspection/deletion, no raw fetch/merge and in-flight guards in scripts/pyats-managed.py (FR-005/006/007/008/009).
- [x] T020 [US3] Launch managed upstream and enforce dynamic-only no-fallback environment in scripts/pyats-stdio.py (FR-001/003/006).
- [x] T021 [US3] Implement official-MCP bounded preview/explicit-activate/list session in scripts/pyats-testbed-session.py with tests (FR-006/009).
- [x] T022 [US3] Label static HUD/editor/collector inventory separately in ui/netclaw-visual/ and extensions/netclaw-vscode/src/views/testbed.ts with regression coverage (FR-009/010).
- [x] T023 [US3] Run actual isolated MCP acceptance including restart, missing credentials, duplicate names and multiple sources; record specs/160-dynamic-pyats-testbeds/verification.md (SC-003/004).

## Phase 6 — US4: maintenance and documentation

Independent test: reproducible install, catalog/build checks and clear qualification
matrix; documentation matches the actual 35 managed tools and both installers.

- [x] T024 [US4] Update README.md, TOOLS.md, SOUL.md, .env.example and workspace/skills/pyats-network/SKILL.md; preserve existing server/skill counts (FR-011).
- [x] T025 [US4] Update docs/GETTING-STARTED-VSCODE.md, INSTALLER-READINESS.md, PYATS-HTTP-MIGRATION.md, ASSISTANT-INSTALL.md and installer/assistant-skills/netclaw-install/SKILL.md (FR-011).
- [x] T026 [US4] Update canonical pyATS catalog metadata, regenerate derived assets/effects stamps and increment source/extension version with CHANGELOG and versioned release notes per repository conventions (FR-001/011).
- [x] T027 [US4] Exercise actual terminal and VS Code UI entry points in isolated homes; record exact feasible coverage/platform limits in specs/160-dynamic-pyats-testbeds/verification.md (SC-001/005).
- [x] T028 [US4] Run relevant Python, extension, HUD, catalog/coherence and build checks; fix failures and record results in specs/160-dynamic-pyats-testbeds/verification.md (FR-012/SC-005).

## Phase 7 — completion

- [x] T029 Reconcile all requirements/tasks/evidence, draft local milestone note in specs/160-dynamic-pyats-testbeds/milestone-draft.md, update memory/2026-10-30.md and GAIT log (FR-012/SC-005).
- [x] T030 Review final diff/secret boundaries and create logical local commits on 160-dynamic-pyats-testbeds; record source status in verification.md (SC-005).

## Dependencies and execution

T001–T002 precede all code. T003–T006 establish the shared contract. US1 can be
verified independently of live source access. US2 follows foundation; US3 follows
US2 and pinning. US4 follows both UI and runtime implementation. T029–T030 follow
all mandatory feasible checks. Tests precede their implementation where practical.
No implementation agent delegation is required. Independent test families can run
concurrently after shared files stop changing. Incremental delivery starts with
static/dynamic policy, then composition, lifecycle and full coherence; all phases
are required for this request, not only the first milestone.
