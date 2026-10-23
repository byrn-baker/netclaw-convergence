# Tasks: NetClaw Dot integration

**Resumed 2026-09-30:** Dots now available on the owner account. MVP server built; real-Dot acceptance (T010) and repository coherence (T011) still open.

Input: spec.md, plan.md, research.md, data-model.md and contracts/tools.md. Update HANDOFF.md at every checkpoint. Test tasks are required by FR010. No runtime implementation before ratification.

## Phase 1 — Research and setup
- [x] T001 Review official Dot/connection documentation and create research.md.
- [x] T002 Create branch and SDD/handoff/operator guide artifacts.
- [x] T003 (partial: real Dot called tools over OAuth; per-surface matrix not yet recorded) [US1] Prove account/host capability with synthetic data; record actual results and selected transport in verification.md. If blocked, document exact reason and continue independent design work.
- [ ] T004 Resolve supported path, output classification and draft ratification in spec.md/plan.md; do not invent approval.

## Phase 2 — Foundation (after T004)
- [x] T005 Implement isolated adapter, strict schemas, trusted identity, allowlists, safe output and local audit under mcp-servers/netclaw-dot-mcp/ using contracts/tools.md.
- [x] T006 Add tests/dot/ authorization, injection, disclosure, limits, timeout, stale/partial, audit-failure and revocation tests; record reproducible commands.

## Phase 3 — User stories
- [ ] T007 [US1] Implement inventory and fixture connector; validate MCP discovery with no mutation tools.
- [ ] T008 [US2] Implement bounded health and scoped audit status; verify backend provenance and live-mode gate.
- [ ] T009 [US3] Read current official packaging docs; build minimal plugins/netclaw-dot/ instructions and supported manifest; test install/disconnect and update docs/NETCLAW-DOT.md with real steps.
- [ ] T010 [US1] Run actual Dot acceptance separately from desktop tests; record background/offline/mobile support matrix.

## Phase 4 — Delivery
- [ ] T011 Run relevant regression and constitution artifact coherence; update applicable installer/catalog/docs only for implemented components. Coordinate version separately from preserved 1.2.0 work.
- [ ] T012 Finish usage/troubleshooting, evidence review, GAIT log, memory and HANDOFF.md completion status. No publish/deploy/communications without applicable authorization.

Dependencies: T001→T002→T003→T004→T005→T006→T007→T008→T009→T010→T011→T012. Independent documentation/fixture design may continue when account gates block execution; never silently waive gates.
