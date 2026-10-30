# Implementation Plan: Reviewed Hermes capacity recovery

**Branch**: `159-hermes-uncertain-capacity` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Add explicit reviewed release to the existing private conversation-open operation.
A durable SQLite audit separates an unknown historical outcome from admission
capacity. Preserve original-conversation blocking and nonce identity. Chat/Avatar
gets a separate confirmed “Release slot and start new chat” action.

## Technical Context

**Language/Version**: Python 3.10+ bridge and JavaScript ESM/React; HUD Node24.19+
**Primary Dependencies**: Existing SQLite, httpx/FastMCP, Express, React; no new dependency
**Storage**: Existing private HUD ledger and owner bindings; additive release table
**Testing**: Python unittest/MockTransport; Node test runner and real React/JSDOM
**Target Platform**: Source fixtures on macOS; Linux CI; no new platform qualification
**Project Type**: Existing private MCP bridge and shared HUD
**Constraints**: Unknown remains unknown, no replay or automatic release; no federation exposure
**Scale/Scope**: Four installation-wide occupied slots; one reviewed release per request

## Constitution Check

Before/after design: PASS. Existing read-before-write, explicit human control,
private evidence, MCP boundary and verification preserved. No new public tools,
components, environment variables or skill counts; generic new-integration
catalog/SOUL/README additions do not apply. Source behavior/docs/tests cohere.
No device/provider changes; source publication and issue replies authorized.

## Structure and phases

1. Reproduce four lost admissions and release rejection conditions.
2. Add transactional release audit to ledger.open and count eligible unreleased
   rows; block federation in Bridge.open and execution-scoped rows in ledger.
3. Add optional boolean to existing private conversation_open MCP schema and
   owned HTTP conversation route. Revalidate ownership after bridge I/O.
4. Add dedicated confirmation in runtime-client and Chat/Avatar action; preserve
   default acknowledgment semantics and old pending receipt.
5. Verify real SQLite restart/concurrency/no-replay, bridge, route, browser and
   prior-fix regressions; document exact limits.

## Complexity Tracking

No exceptions. No generic state override, new tool, deadline inference or run
lookup heuristic. Existing eight-tool inventory remains unchanged.
