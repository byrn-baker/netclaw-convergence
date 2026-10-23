# Feature Specification: Jev Science Officer

**Feature Branch**: `125-jev-science-officer`
**Created**: 2026-09-27
**Status**: Implemented and locally verified — see verification.md
**Input**: Optional Jev as Spock to Border's Kirk, with dynamically authored typed judgments and visible advisory influence. Reprioritized spec125 precedes the separate three.js HUD redesign.

## User Scenarios & Testing

### User Story 1 — Enable an optional advisor (Priority: P1)
An operator enables Jev during install or afterward, supplies a hosted key or compatible endpoint, and sees a dedicated Science Officer with truthful availability and advisory authority.
**Independent Test**: Default disabled install makes no inference call; configured advisor reports status without leaking a key.
**Acceptance Scenarios**:
1. Given no opt-in, when NetClaw runs, then its existing behavior remains available and Jev makes no outbound calls.
2. Given explicit setup, when viewing RISK/HUD, then Science Officer is identified as an advisor, not a device executor or conversational frontier model.
3. Given incompatible endpoint responses, then evaluation is unavailable rather than falsely successful.

### User Story 2 — Ask context-specific questions (Priority: P1)
Border forms questions from the human's task, member evidence and proposed decisions. The advisor supports evidence review, specialist advice and final-answer review first, plus diagnostic advice, change-plan review and incident triage.
**Independent Test**: Two distinct synthetic tasks produce distinct caller-authored questions and all three primitive formats are handled in one call.
**Acceptance Scenarios**:
1. Given a consequential recommendation or operational summary, Border consults the advisor using task-specific questions when enabled.
2. Given returned probabilities, Border retains decision authority and existing permissions; no evaluation executes a device operation or grants access.
3. Given specialist advice, candidates must already be eligible; no model answer expands their scope.
4. Given changed evidence, Border may perform one reconsideration; a chain or duplicate reconsideration is refused.

### User Story 3 — Understand advisory influence (Priority: P1)
The human sees a brief assessment stating whether Jev supported, challenged or changed Border's recommendation, with uncertainty and evidence age when relevant.
**Independent Test**: An assessment can be traced to exact questions, supplied evidence metadata, endpoint/model, result and cost.
**Acceptance Scenarios**:
1. Given agreement, report model support without claiming guaranteed correctness.
2. Given material disagreement after one reconsideration, report the unresolved difference.
3. Given timeout, malformed output or exhaustion, report assessment unavailable and preserve normal permissions.

### User Story 4 — Control disclosure and spending (Priority: P1)
An operator sets daily and originating-task spending limits and controls private-data disclosure.
**Independent Test**: Concurrent calls cannot pass admission once their combined reservations exceed a cap; private disclosure without exact approval never reaches hosted service.
**Acceptance Scenarios**:
1. Defaults are $5 per UTC day and $0.25 per originating task; both are configurable during setup and afterward by the operator.
2. All calls, ambiguous failures and reconsiderations count; restarting a process does not reset totals.
3. Sanitized evidence is the default. Additional private disclosure requires explicit, expiring approval for exact payload, destination and task; credentials remain excluded.
4. No task identifier supplied by the model can reset a budget. Unbound calls share a conservative fallback case until the operator binds a task.

## Edge Cases

Missing key; disabled integration; custom endpoint lacking probabilities; malformed/nonfinite distributions; duplicate questions; oversized context; stale or missing evidence; prompt injection in member data; provider failure after accepting a request; concurrent processes; UTC midnight; changed endpoint/model/pricing; zero-price local endpoint; expired/reused approval; payload modified after approval; reconsideration of another task; raw secret in question as well as state.

## Requirements

### Functional Requirements

- **FR-001**: Optional activation, explicit setup, visible Science Officer status and typed evaluation service.
- **FR-002**: Accept dynamically authored Noul, Choice and Score questions together; no static question library or generated text masquerading as typed provider probabilities.
- **FR-003**: Support six narrow advisory workflows with automatic agent instructions at consequential decisions/final summaries and on-demand use.
- **FR-004**: Advisory/read-only authority; preserve deterministic eligibility, change approval, consent and device execution gates.
- **FR-005**: At most one reconsideration per initial assessment; report remaining material disagreement.
- **FR-006**: Separate probability, rubric score and distribution-derived confidence; show concise influence and provenance, never guaranteed correctness.
- **FR-007**: Hosted Jev and compatible endpoints with validated contracts, explicit pricing and truthful provider identity; keys never reach browser or audit output.
- **FR-008**: Default sanitized disclosure; exact, task/destination-bound operator approval for extra private data; credentials excluded even with approval.
- **FR-009**: Persistent concurrent spending admission at $5/day and $0.25/task, operator overrides, actual usage accounting and conservative unknown-charge reservations.
- **FR-010**: Bounded request size, wall-clock deadline, no hidden retry loops; distinct disabled, unavailable, approval-required, budget-exhausted and invalid states.
- **FR-011**: Audit exact questions, evidence metadata/digest, versions, results, influence linkage and cost locally; report GAIT availability honestly.
- **FR-012**: Installer, configuration, skills, README/SOUL/TOOLS and current HUD remain coherent; no HUD redesign in this feature.

### Key Entities

Advisor configuration; originating task; evidence snapshot; dynamic question batch; assessment; reconsideration link; disclosure approval; budget reservation; operator settings.

## Success Criteria

- **SC-001**: Disabled/missing configuration makes zero paid requests in acceptance tests.
- **SC-002**: Synthetic calls demonstrate all three primitives and distinguish provider failure from negative judgment.
- **SC-003**: Concurrent admission, restart and deadline tests retain both spending limits with unknown costs conservatively charged.
- **SC-004**: Negative tests prove payload/destination/task changes invalidate disclosure consent and repeated reconsideration cannot extend the loop.
- **SC-005**: All six workflows document dynamic question construction, boundaries, failure behavior and concise human influence reporting.
- **SC-006**: Real MCP lifecycle, installer tests and existing affected runtime/HUD suites pass; one frugal live synthetic provider smoke is recorded separately from domain accuracy.

## Assumptions and Scope

User approved these requirements in conversation before “proceed”; details are in clarification.md. Installer offers setup by default but does not activate without opt-in/configuration. Advisory service identity need not impersonate an enrolled chat agent. Automatic consultation is an agent workflow instruction, not an authorization enforcement mechanism. The frontier model authors questions and explanations; Jev returns judgments. Neither network calibration nor self-hosted Jev weights is assumed. The user subsequently authorized frugal live testing using their .env key; synthetic payloads only, test budget $0.01. No network configuration, external messages, ticket creation, publishing or unrelated audit work.

## WSL adoption follow-up — 2026-09-27

User requested a concrete WSL upgrade handoff and then authorized commit/PR/merge/branch deletion/main. Read-only installed-path review found hidden interactive prompts and missing registration on existing configs. Scope adds preview/apply/conflict-safe recovery for Jev-only MCP registration and Border persona/skills, plus explicit env-file loading for the registered process. No actual WSL deployment is claimed. Preserve existing RISK identity/configuration and keep HUD changes basic. Revalidate affected paths before merge.
