# Feature Specification: Fleet FastMCP modernization

**Feature Branch**: `141-fastmcp-stateless-upgrade`
**Created**: 2026-10-04
**Status**: Implemented for migrated scope; fleet acceptance open on documented external ports and licensed validation

## User Scenarios & Testing

### User Story 1 — Reliable fresh installs and upgrades (P1)
Operators install any affected MCP component without resolving an obsolete or incompatible framework.
**Independent test:** resolve each affected manifest in isolation and start its real entry point with safe fixture configuration.
**Acceptance:** all owned FastMCP servers use the selected stable release; external integrations have explicit, reproducible upgrade or compatibility dispositions. Existing installations remain recoverable.

### User Story 2 — Modern sessionless clients with legacy compatibility (P1)
Operators use current protocol clients without breaking existing NetClaw stdio callers.
**Independent test:** discover tools and invoke fixture-only tools using both protocol eras; exercise independent HTTP requests without a session header.
**Acceptance:** tools retain names, input contracts, authorization and durable application state. No default network listener is introduced. Transport independence does not imply application-level multi-replica safety.

### User Story 3 — Reviewable maintenance (P2)
Maintainers can reproduce the inventory, pin decisions, tests and rollback from this branch.
**Independent test:** run inventory and regression checks in a clean environment.
**Acceptance:** every affected integration is classified; limitations and unavailable vendor tests are distinguishable from passes; optional framework capabilities have documented adoption decisions.

### Edge Cases
- SDK-v1 imports despite standalone FastMCP already being installed.
- Removed decorators, private tool managers, constructor transport options and SDK types.
- Upstream clones ignored by Git; edits there alone cannot ship.
- Stateful caches, collectors, conversations, approval records and persistent stores.
- Credentials or licensed SDKs unavailable for vendor verification.
- Version conflicts with FastAPI, Pydantic and other isolated components.

## Requirements
- **FR-001:** Inventory owned, vendored and installer-managed external FastMCP integrations and their launch paths.
- **FR-002:** Select the latest non-prerelease published framework and compatible SDK at research time; record exact versions and sources.
- **FR-003:** Update tracked server code, dependency declarations and installer runtime constraints together.
- **FR-004:** Preserve existing stdio defaults and legacy tool contracts, including rejection paths.
- **FR-005:** Verify modern sessionless protocol behavior and legacy compatibility with real framework execution.
- **FR-006:** Preserve authentication, read-only defaults, consent, change-control and audit boundaries. New framework features grant no new authority.
- **FR-007:** Keep upgrades isolated from the host Python and unrelated integrations; preserve rollback instructions.
- **FR-008:** Use reproducible tracked patches for externally owned source when approved; record unsupported or unavailable cases honestly.
- **FR-009:** Review optional features (tasks, discovery transforms, auth, middleware and telemetry); do not silently change catalogs, execution semantics or privacy.
- **FR-010:** Record verification by integration and run relevant installer, security, protocol and application regressions.

### Key Entities
Compatibility inventory: source ownership, imports, manifest, runtime, state assumptions, upgrade disposition, evidence.
Release baseline: exact versions, source links, package metadata and reproducible install requirements.

## Success Criteria
- **SC-001:** Every detected FastMCP integration has a documented disposition and no owned integration remains on the old framework.
- **SC-002:** All owned tool catalogs remain discoverable under the new runtime; intentional schema differences are explained and tested.
- **SC-003:** Modern and legacy protocol tests pass, including malformed input and denied operations.
- **SC-004:** No production configuration, live vendor mutation or external communication occurs during development verification.

## Assumptions
The request authorizes branch-local implementation and tests, not deployment or publishing. Latest means stable PyPI release verified now. Stdio remains the default. Application state is retained; sessionless transport is not permission to remove state or enable arbitrary horizontal scaling. Non-FastMCP MCP servers are inventoried as adjacent compatibility concerns rather than rewritten without need.
