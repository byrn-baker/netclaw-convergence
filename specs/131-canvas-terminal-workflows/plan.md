# Implementation/adoption plan: Canvas terminal workflows

**Branch**: `131-canvas-terminal-workflows` | **Date**: 2026-09-28

**Spec**: [spec.md](spec.md)

## Summary

Adopt the previously developed browser-terminal contribution on the current HUD
base, retain attribution, add its optimization pass, and expose review/validation
gaps in a draft. No new live-device implementation is authorized by PR preparation.

## Technical context

- React 18/Vite 6 web frontend; Express/ws/ssh2 API; xterm 6 pinned.
- Local Python adapter for pyATS/Genie; isolated runtime installer, Windows/WSL bridge.
- Storage: existing Canvas IndexedDB, local inventory/authorization/audit files and
  bounded server-memory observations/provider caches. See feature docs for retention.
- Tests: synthetic loopback SSH, Node unit/UI fixtures, mocked Python installer/parser,
  production build and static-import budget. No credentials in CI.

## Constitution check — unresolved gates

Spec-first ratification cannot be claimed retrospectively. Maintainers must decide
whether to adopt/split this existing contribution. Direct SSH/provider adapters and
the scoped Local/Lab audit exception require architecture/policy review; no exception
is granted by this document. Release metadata is deferred while this remains draft.
Proposed completed-feature bump: 1.1.0 to 1.2.0, coordinated with main before merge.

No new MCP server is registered, so catalog/install-function and integration counts
are unchanged, not inflated for UI adapters. README, environment documentation, GUI,
policy notes and tests are present. TOOLS documents the local UI boundary. GAIT tools
are unavailable in the contribution environment; local session notes are not GAIT.

## Project structure and preservation boundaries

- `src/canvas-chat/App.jsx`: existing graph/chat/session orchestration.
- `TerminalLane.jsx`, `LazyLane.jsx`, shared export/theme helpers: terminal UI/lifecycle.
- Root API modules under `ui/netclaw-visual/`: SSH profiles/trust, topology, intent,
  Genie and opt-in observability. `server.js` retains upstream guards and route wiring.
- `test/`, `scripts/`, `tests/canvas-terminal/`: synthetic suites and CI entry points.
- No changes to upstream dashboard/classic/assessment components, private testbeds,
  standalone Electron client or unrelated commit history.

## Adoption sequence

1. Confirm current upstream and spec-number availability.
2. Record scope, constraints, existing implementation and outstanding decisions.
3. Include the completed refactor without changing API/SSH authorization semantics.
4. Add reproducible CI coverage for the new test family; check declarations and secrets.
5. Commit, push a new fork branch and open a draft against upstream main.
6. Obtain maintainer decisions, Linux/live evidence, and coordinated release metadata.

Rollback is to the prior reviewed commit; no saved Canvas database migration occurs.
New windows/features unavailable in an older build may not render there. Back up
operator state before deployment; no production instance is restarted by this PR.
