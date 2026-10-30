# Implementation Plan: Preserve Canvas Context Across Hermes Setup Retry

**Branch**:`157-hermes-canvas-retry` | **Date**:2026-10-29 | **Spec**:[spec.md](spec.md)

## Summary

Capture the normalized initial prefix in the same private binding write that creates a Hermes task. Always pass that stored prefix to conversation_open; the bridge's existing immutable/idempotent seed contract validates it. No initialization flag is needed. Legacy tasks omit seeds.

## Technical Context

**Language/Version**: Existing JavaScript ESM/Node24.19.0.

**Primary Dependencies**: Express and existing private atomic writer.

**Storage**: Existing owner-private JSON bindings,30-day expiry,8MiB read/write bound.

**Testing**: Node test runner, real Express routes/Bindings and controlled bridge; Python bridge MockTransport.

**Target Platform**: Existing HUD server platforms; isolated Mac verification.

**Project Type**: HUD recovery defect fix.

**Performance Goals**: No added upstream call; one existing binding write retains seed.

**Constraints**:1MiB UTF-8 seed,200messages,role/content only; no runtime/provider/device access.

**Scale/Scope**: One task creation path, Hermes submission route, regression suites.

## Constitution Check

Before research/after design PASS: no device writes (I–III,VIII), GAIT active(IV), existing interfaces and no new tool(V–VII,XI), private bounded storage(IX,XIII), docs and legacy compatibility(XII,XV), no external communication(XIV), ordered SDD(XVI). Record local milestone only(XVII).

## Project Structure

- ui/netclaw-visual/src/hud-server/bindings.js: optional immutable Hermes seed on task creation, guarded save bound.
- ui/netclaw-visual/src/hud-server/runtime/routes.js: normalize before creation; use stored seed on every open.
- ui/netclaw-visual/src/hud-server/runtime/recovery.test.js: actual HTTP retry/restart/ownership regression.
- tests/hermes-hud/test_recovery.py: first admitted run retains prefix through bridge setup retry.
- docs/HERMES-HUD.md: recovery and pre-fix binding limit.

## Phases

Reproduce → bind immutable seed → route retry → targeted regression → evidence/local commit. Same task lock/nonce and unknown-outcome rules remain.

## Complexity Tracking

No violations. Reusing immutable seed on every idempotent open is simpler than maintaining an additional ready flag with failure windows.
