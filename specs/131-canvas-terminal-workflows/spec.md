# Feature Specification: Canvas network-terminal workflows

**Feature Branch**: `131-canvas-terminal-workflows`

**Created**: 2026-09-28

**Status**: Draft — maintainer scope/design review required

**Input**: Integrate the existing browser terminal contribution and optimization
work with the latest NetClaw HUD, excluding the separate Electron application.

## Process disclosure

This is an adoption proposal for an already-built contribution. Its implementation
predates these numbered artifacts; this is **not** evidence that a ratified spec
existed before implementation. The checked-in `.specify/templates/` were followed
manually; the `.claude/commands/` files referenced by CONTRIBUTING.md are absent
from this checkout. Spec-first compliance and maintainer agreement are outstanding.
131 was available among fetched specs, branches and open PRs when prepared;
reservation must be coordinated before merge. The PR remains a draft.

## User Scenarios & Testing

### US1 — Keep the CLI inside the Canvas (P1)

An engineer opens an SSH terminal without leaving the new HUD, manages device
profiles, selects CLI evidence and branches it into a conversation or result.

**Independent test**: synthetic SSH/PTTY fixture and browser terminal preview.

1. Given the new HUD, opening Canvas preserves standard Chat, Overview, native
   OpenClaw navigation and the existing persistent Canvas/session behavior.
2. Given a configured device, connection prompts for unknown/changed host-key
   trust and needed credentials; legacy KEX requires per-device opt-in.
3. Given a testbed edit, preserve unrelated YAML and credentials, check revision,
   back up changes and reject removal/edit of an actively used profile.
4. Given selected terminal text, branch from the selection without losing its
   source highlight; creating a result yields a clearly accessible artifact.

### US2 — Explain the network without hiding evidence (P1)

An engineer authorizes read-only collection and sees correlated context beside
an IP or prefix while retaining the traditional terminal experience.

**Independent test**: topology fixtures, closest-device tests and synthetic preview.

1. Context distinguishes reporting router, directly connected/local evidence,
   inferred closest reporter and actual address ownership; unknown is not guessed.
2. Collection is bounded, scoped, revocable and freshness-labeled. Hover does not
   launch external discovery. The pane never covers terminal text.
3. Device-scoped topology images support explicit sharing and mapped role markers:
   green for the current terminal, red for the reporting device, no redundant red
   marker for local/connected evidence. Images are not sent to routers or AI.

### US3 — Structured output and explicit intent (P2)

**Independent test**: artifact, Genie, intent execution and change-policy suites.

1. JSON uses the local pyATS/Genie adapter, reports unsupported/unavailable parsing
   honestly and never substitutes invented nesting for parser success.
2. Intent shows observed tool activity separately from agent-reported results;
   unverified execution stays uncertain. Credentials never enter generated artifacts.
3. Production change controls remain; only explicit endpoint-scoped Local/Lab
   grants can select local approval. Collector consent remains read-only.

### US4 — Optional context without a heavyweight startup (P2)

**Independent test**: observability mocks, lazy-window tests and bundle budget.

1. Optional provider polling requires explicit source/scope authorization and
   preserves origin, age, truncation and uncertainty. NetBox/SNOW demo is fake.
2. Initial Canvas static JavaScript stays below 400,000 uncompressed bytes;
   terminal, configuration-review and result windows load on demand.
3. A failed optional-window load offers retry without unmounting sibling sessions.

### Edge cases

Authentication/key changes, inaccessible pyATS runtime, overlapping VRFs, stale
observations, ambiguous reporters, invalid parser output, canceled authorization,
late async responses, closed/minimized windows and chunk download failure must
retain existing fail-closed or clearly uncertain behavior.

## Requirements

- FR-001: Preserve the upstream HUD and saved Canvas schema/access controls.
- FR-002: Retain attributed, validated evidence and bounded collection.
- FR-003: Never grant write access from collector consent or infer lab mode.
- FR-004: Keep secrets, actual testbeds, uploads and runtime state out of Git.
- FR-005: Do not include Electron or the standalone terminal product/history.
- FR-006: Declare supported adapters accurately: Infoblox NIOS, ThousandEyes,
  namespace-scoped Kubernetes reads and OTLP/HTTP JSON health metrics only;
  VMware/ExtraHop remain planned. No general NetFlow/SNMP/syslog ingestion claim.

## Success criteria

- SC-001: All offline Canvas suites and production bundle budget pass.
- SC-002: Existing HUD tests have no new failures relative to upstream.
- SC-003: No unrelated dashboard/runtime files are replaced to add Canvas features.
- SC-004: Maintainers review architectural/policy exceptions and Linux evidence
  before the PR is marked ready; live acceptance gaps remain visible.

## Assumptions and non-goals

Loopback, single-operator web application; no new company-wide RBAC, distributed
collector orchestration or automatic production authorization. No live device,
provider or model calls are needed to build/test this contribution.
