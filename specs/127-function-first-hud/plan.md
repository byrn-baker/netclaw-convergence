# Implementation Plan: Function-first HUD

**Branch**: `127-function-first-hud` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

## Summary

Add a readable dashboard shell around existing operational surfaces and preserve Adam's complete canvas as a first-class workspace. Normalize sources, keep authority boundaries explicit, mediate detailed Jev reads through trusted task ownership, and retain Three.js for optional relationship exploration.

## Technical Context

Existing JavaScript/JSX React 18, Vite 6, Express 4 and Three.js application in `ui/netclaw-visual`; use the repository's supported Node runtime and existing lockfile. Browser IndexedDB remains canvas storage. Existing Python Jev MCP ledger owns assessments. Node test runner/jsdom cover contracts and UI logic; browser journeys cover persistence, focus, navigation and rendering. Target macOS, Linux and Windows-browser→WSL, plus responsive browsers over the existing allowed local/tunneled access model.

Performance target: 200 entities/1,000 relations, 200ms p95 local selection/mode response and 2s usable fixture dashboard. Record the test machine/browser; cap/paginate larger datasets and do not represent clipped results as complete.

## Constitution Check

- Specification precedes runtime work; ratification remains the implementation gate under Principle XVI. This package implements the user's requested spec start and does not claim ratification.
- No device writes or new bypasses. Existing MCP, ITSM, GAIT, disclosure and approval workflows remain authoritative.
- Existing entry points and saved data are preserved. Security reviews cover current shared chat/WS surfaces before adding private detail.
- No new MCP integration is planned; catalogue/tool counts do not increase merely because a panel exists. Coherence review still checks README, TOOLS, installer, config and environment documentation for actual changes.
- Local code/spec work does not publish messages, tickets or deployments. A milestone blog is drafted after implementation, before any publication.

## Structure

Keep `src/canvas-chat/App.jsx`, `session-gate.js`, canvas license and `canvas.html`. Add modular dashboard shell/views/adapters under `src/dashboard/`; optional assessment components under `src/canvas-chat/` or shared dashboard components. Reuse `src/orgchart/` and `src/orgchart-render/` semantics. Add server-side mediation modules under a dedicated HUD server module directory rather than further enlarging `server.js`; finalize its name during the spike.

Do not change the canvas IndexedDB database name or origin as a side effect of routing. Keep Vite's two entry points. Avoid a broad canvas refactor before preservation tests exist.

## Delivery sequence

1. Capture canvas behavior and old-format synthetic session fixtures. Inventory every existing route/control and producer. Record clean test/build baseline and host boundaries.
2. Implement sourced view models and dashboard shell with Basic/Advanced, failure states and persistent canvas/chat access. Demonstrate standalone first, then mixed deployment fixtures.
3. Establish authenticated task/message provenance and scoped Jev reads. Resolve the gateway hook, trusted task lifetime, budget identity and cache/event isolation before rendering private details.
4. Add Jev typed assessment and comparison views inside canvas context/source/summary affordances; add the standalone Science Officer destination using the same authorized components.
5. Complete RISK, peers, mobile and capability navigation; preserve existing settings/RAG/Zoom/utilities and add scoped operational evidence adapters where justified by real producers.
6. Add optional Three.js views sharing the normalized records and detail panels. Prove table fallback, context loss and hidden-view resource cleanup.
7. Run functional, security, persistence, visual/accessibility and performance acceptance. Validate actual supported hosts separately. Update docs, record gaps and draft milestone blog.

## Release and recovery

Develop incrementally with the existing canvas route working throughout. Before switching the dashboard default, all canvas preservation tests must pass. Keep migration/export recovery documented and test rollback on a copy of synthetic persisted sessions. Release rollback must not discard new messages or trusted task data. No new public listener or changed origin is required. A detailed Jev view cannot be marked complete while its binding is unavailable.

## Complexity Tracking

No constitutional exception proposed. Authenticated task mediation is the principal integration risk; cosmetic UI work does not resolve it. Full native mobile and WSL acceptance require their actual environments and must stay pending until exercised.
