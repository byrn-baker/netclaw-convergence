# Feature Specification: Reviewed recovery of Hermes admission capacity

**Feature Branch**: `159-hermes-uncertain-capacity`

**Created**: 2026-10-29

**Status**: Approved for implementation by the owner's four-issue SDD request

**Input**: Issue #302, fourth in chronological order after #262, #300 and #301.

## User Scenarios & Testing

### User Story 1 — Recover a slot after reviewing an unknown outcome (P1)

As the operator, I can review an uncertain request and explicitly release its
admission slot while opening a new conversation. Its outcome stays unknown;
releasing capacity does not cancel, undo, resolve or replay the operation.

**Independent test**: Four lost admission responses fill the limit. Ordinary
acknowledgment and restart do not release slots. Explicit reviewed release frees
one slot for a new request; every old nonce remains attached to its original run.

**Acceptance scenarios**:
1. Given four unknown requests without native run IDs, when the owner confirms
   release for one exact request and starts a new conversation, then one new
   request is admitted and no old request is posted again.
2. Given a released request, when the ledger restarts or release is repeated,
   then its unknown outcome and durable release record survive without further
   capacity credit. Its original conversation remains blocked for new work.
3. Given a known native run, active/terminal request, foreign owner, missing
   acknowledgment or federation execution, when release is attempted, then it
   is refused without changing capacity.

### User Story 2 — Understand and control the recovery action (P1)

As the operator, I can distinguish acknowledging uncertainty from releasing a
slot. The release confirmation asks me to review history/tool evidence and accept
that an earlier operation may still run alongside new work. Cancelling does
nothing. A failed setup/reply can be retried without duplicating the release.

## Requirements

- **FR-001**: Only an explicit owned, installation-scoped operator action may
  release capacity for an unknown request with no native run ID.
- **FR-002**: Persist an idempotent release audit, preserve unknown outcome,
  original nonce, body and evidence, and retain the same-conversation guard.
- **FR-003**: Exclude exactly eligible released rows from installation admission
  accounting; unreleased and known active runs retain the four-request limit.
- **FR-004**: Default acknowledgment, status, stop, reload and expiry never
  implicitly release capacity or submit/replay work. Federation is excluded.
- **FR-005**: Expose distinct confirmed recovery in Chat/Avatar with honest
  uncertainty wording; retain original history and request receipt on failure.
- **FR-006**: Preserve existing tool inventory and backward-compatible arguments;
  document source upgrade, audit semantics and verified limits.

## Success Criteria

- **SC-001**: Four lost-response fixture recovers after explicit review across
  restart, with exactly one upstream POST for each original nonce and one for
  the newly authorized request.
- **SC-002**: Automated rejection tests cover owner, missing/invalid intent,
  known-run, active, terminal, federation and duplicate/concurrent release.
- **SC-003**: UI tests prove cancellation sends no request, acknowledgment alone
  does not release, and confirmed release sends the exact owned request ID.

## Scope and assumptions

This is an admission-accounting decision, not proof of runtime quiescence. Native
run lookup by idempotency key is not qualified; do not infer a run from text or
session history. No automatic replay, record deletion, provider/device work or
federation recovery is introduced. Existing browser ownership and private MCP
authorization remain authoritative. Source patch/history and GitHub responses
for all four fixes are additionally authorized by the owner's follow-up.
