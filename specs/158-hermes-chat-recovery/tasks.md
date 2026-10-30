# Tasks: Preserve Submitted Questions and Drafts During Recovery

Input: spec, plan, research, model and recovery contract.

## Phase 1: Setup

- [x] T001 Inspect real UI/storage/history contracts in specs/158-hermes-chat-recovery/research.md (FR-001–FR-005).

## Phase 2: Foundation

- [x] T002 Reproduce edited-draft misattribution in ui/netclaw-visual/src/dashboard/hermes-ui.test.js before implementation (FR-001–FR-003).

## Phase 3: US1 — Recover original

Independent test: ORIGINAL/answer displayed, UNSENT preserved in composer/storage, onePOST.

- [x] T003 [US1] Save immutable submission metadata in ui/netclaw-visual/src/shared/runtime-client.js; retain completed receipt only for StandardChat submissions with local recovery metadata (FR-001,FR-005).
- [x] T004 [US1] Add bounded structural recovery helper in ui/netclaw-visual/src/dashboard/chat-recovery.js and integrate StandardChat.jsx; clear stale inFlight and preserve edited/cleared drafts (FR-002–FR-003).

## Phase 4: US2 — Repeated observation

Independent test: tagged pairs and exact anchored native history merge once; mismatches preserve content and return guidance.

- [x] T005 [US2] Preserve requestId in ui/netclaw-visual/src/dashboard/chat-storage.js and cover refresh/archive/anchor/repeated-identical-prompt cases in chat-storage.test.js and chat-recovery.test.js (FR-002,FR-004).
- [x] T006 [US2] Extend actual UI/runtime tests for edited/cleared/untouched draft, remount, repeated status, history load and no replay in hermes-ui.test.js and ../shared/runtime-client.test.js (FR-001–FR-005).

## Phase 5: Closure

- [x] T007 Document conservative recovery/legacy limits in docs/HERMES-HUD.md; run tests/build and record specs/158-hermes-chat-recovery/verification.md, GAIT and daily memory; commit locally (FR-004–FR-005,SC-001–SC-003).

## Dependencies and Strategy

T001→T002→T003→T004→T005→T006→T007. US1 delivers the fix, US2 proves idempotence and compatibility. Pure helper testing may accompany UI reads; implementation remains sequential. Existing Canvas/classic completion cleanup remains unchanged.
