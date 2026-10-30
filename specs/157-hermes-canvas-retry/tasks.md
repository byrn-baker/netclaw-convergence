# Tasks: Preserve Canvas Context Across Hermes Setup Retry

Input: spec, plan, research, model and retry contract in this directory.

## Phase 1: Setup

- [x] T001 Confirm route/bridge lifecycle and failure in specs/157-hermes-canvas-retry/research.md (FR-001–FR-003).

## Phase 2: Foundation

- [x] T002 Add failing retry/restart/immutable-context regression in ui/netclaw-visual/src/hud-server/runtime/recovery.test.js (FR-001–FR-003).

## Phase 3: US1 — Retry context

Independent test: failed setup submits zero work; restart/retry uses original ancestors in first admitted request.

- [x] T003 [US1] Persist initial seed atomically in ui/netclaw-visual/src/hud-server/bindings.js and use it in ui/netclaw-visual/src/hud-server/runtime/routes.js (FR-001–FR-003).
- [x] T004 [US1] Confirm first-run prefix through actual Bridge and MockTransport in tests/hermes-hud/test_recovery.py (FR-002–FR-003).

## Phase 4: US2 — Private compatibility

Independent test: foreign owners fail, legacy/empty seeds remain distinct and rejected oversized writes preserve readable state.

- [x] T005 [US2] Bound/validate seed and writes in ui/netclaw-visual/src/hud-server/bindings.js; add ownership/legacy/storage tests in ui/netclaw-visual/src/hud-server/runtime/recovery.test.js (FR-004–FR-005).
- [x] T006 [US2] Document existing-binding recovery limit in docs/HERMES-HUD.md (FR-005).

## Phase 5: Closure

- [x] T007 Run focused suites and record specs/157-hermes-canvas-retry/verification.md, GAIT and daily memory; commit locally (FR-001–FR-005, SC-001–SC-003).

## Dependencies and Strategy

T001→T002→T003→T004→T005→T006→T007. US1 is MVP, US2 verifies its boundaries. Research may run alongside source reading; issue implementation stays chronological and mutations sequential. No deployment.
