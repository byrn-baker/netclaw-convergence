# Tasks — spec159 / issue302

## Phase 1 — Reproduce and establish invariants

- [x] T001 [US1] Add failing four-lost-admission/restart/no-replay bridge regression in tests/hermes-hud/test_recovery.py (FR001–004, SC001).
- [x] T002 [US1] Add ledger eligibility, unchanged same-conversation limit, durable/concurrent idempotency and failure tests in tests/hermes-hud/test_ledger.py (FR001–004, SC002).

## Phase 2 — Durable private recovery

- [x] T003 [US1] Implement additive release audit/accounting in ledger.py and HUD-only bridge.py projection/open contract; preserve eight tools through optional server.py argument (FR001–004, FR006).
- [x] T004 [US1] Validate and forward explicit release in runtime/routes.js with owner-before/after checks and regression tests (FR001, FR004, SC002).

## Phase 3 — Operator workflow

- [x] T005 [US2] Implement separate reviewed recovery confirmation/action in runtime-client.js and StandardChat.jsx; test cancel/default acknowledgment/explicit exact ID/failure with actual React (FR005, SC003).

## Phase 4 — Verification and documentation

- [x] T006 Run bridge, ledger, ownership, UI and prior-fix suites plus HUD build; record actual results and analysis in verification.md (FR001–006, SC001–003).
- [x] T007 Update docs/HERMES-HUD.md and bridge README with review/upgrade/audit limitations; log daily memory/GAIT and commit issue302 (FR006).

Dependencies: T001→T002→T003→T004→T005→T006→T007. All are sequential for this
small shared-code fix. MVP: full reviewed recovery; no automatic-release shortcut.
