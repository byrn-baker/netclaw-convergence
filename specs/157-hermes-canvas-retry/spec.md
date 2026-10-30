# Feature Specification: Preserve Canvas Context Across Hermes Setup Retry

**Feature Branch**: `157-hermes-canvas-retry`

**Created**: 2026-10-29

**Status**: Accepted under the owner's chronological four-issue SDD request

**Input**: [Issue #300](https://github.com/automateyournetwork/netclaw/issues/300), created2026-10-18T04:02:41Z; follows completed issue262/spec156.

## User Scenarios & Testing

### User Story 1 - Retry a branch without losing ancestors (Priority: P1)

An operator retries a Canvas branch after conversation setup fails before submission. The first successfully admitted question still includes its original ancestors.

**Why this priority**: A reply without inherited context silently answers a different investigation.

**Independent Test**: Fail the first setup before admission, restart the local route fixture, retry with a new nonce and inspect the successful setup and submitted context.

**Acceptance Scenarios**:

1. **Given** an ancestor question/answer and follow-up, **When** setup fails and the operator retries, **Then** the original ancestor prefix reaches the successful conversation and no agent request is submitted by the failed attempt.
2. **Given** a lost setup response after preparation, **When** setup is retried, **Then** the same immutable prefix is supplied without replacing established context.
3. **Given** a later follow-up with additional history, **When** submitted, **Then** the original conversation seed stays unchanged.

### User Story 2 - Preserve ownership and existing conversations (Priority: P2)

An operator's retained branch context remains private, bounded and scoped to the same conversation across restarts.

**Why this priority**: Context retention must not expose private investigations or corrupt existing conversations.

**Independent Test**: Reload bindings, use a foreign cookie, exercise a legacy binding and exceed the storage bound.

**Acceptance Scenarios**:

1. **Given** a retained prefix, **When** bindings restart, **Then** the same owner can resume and another owner cannot read/use it.
2. **Given** a legacy conversation without retained initial context, **When** it is reused, **Then** later messages are not invented as its original ancestors.

### Edge Cases

Empty prefix; changed retry context; expired/revoked ownership; known failure versus lost admission; oversized context; response lost after bridge preparation; existing conversations created before this fix.

## Requirements

### Functional Requirements

- **FR-001**: The original ancestor prefix MUST be retained atomically with a newly created branch binding before any upstream setup call.
- **FR-002**: Retrying setup MUST reuse that immutable prefix across process restarts and new retry identities; later context MUST NOT replace it.
- **FR-003**: Known setup failure MUST retain nonexecution reporting and MUST NOT submit an agent request; lost admission MUST retain uncertainty and no replay semantics.
- **FR-004**: Retained context MUST use existing owner-private, expiring storage and obey existing input/storage bounds.
- **FR-005**: Existing conversations without retained seeds MUST remain usable without guessing or backfilling their initial history; recovery guidance MUST explain this limitation.

### Key Entities

- **Branch binding**: Owner-scoped conversation identity and immutable initial ancestor prefix.
- **Request**: One explicit submission and its nonce/outcome, separate from conversation preparation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Failed setup plus restart/retry preserves all original ancestor messages in the first successful admission.
- **SC-002**: The failed setup causes zero agent submissions; one explicit retry causes one submission.
- **SC-003**: Ownership, established-history, empty-context and storage-bound regressions pass.

## Assumptions

Local source fix and isolated tests only. The existing bridge already enforces immutable conversation seeds. Existing pre-fix bindings cannot recover context that was never recorded; recreate a branch after a known pre-admission failure if that context is needed. No deployment or external communication is included.
