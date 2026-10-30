# Delegate contracts

The coordinator owns the active spec, integration, acceptance and final report.
Use at most two concurrent workers; after they finish, request one independent
verifier. All work counts against the same run budget. Workers return to the
coordinator rather than recursively spawning more agents.

## Dispatch

Give each delegate this contract, filled from the actual task:

- Task ID, intended outcome and exact acceptance criteria.
- Checkout path, branch and starting commit; existing uncommitted changes.
- Role and permitted files/actions; files owned by other workers.
- Exact evidence needed, known constraints and remaining run budget.
- A direction to report findings, changed files, commands/results and blockers.

Assign one writer per file. Use concurrent implementation only for disjoint file
sets. Shared spec/ledger edits and commits belong to the coordinator. A worker
needing a file owned by another worker reports that dependency before editing.
Keep workers in the explicit checkout; do not let them switch the shared branch.

## Researcher

Read-only. Resolve a specific uncertainty using repository evidence or primary
sources. Return paths/lines or source links, conclusions and remaining unknowns.
Research is complete when it supports a decision or identifies the missing input.
It is not implementation or runtime verification evidence.

## Implementer

Change only the assigned files for one spec task. Reproduce the relevant failure
or document the initial acceptance gap, implement the smallest sufficient change,
and run affected checks. Return actual results, including failures and untested
boundaries. Escalate a necessary scope change to the coordinator; do not broaden
into adjacent features to keep busy.

## Independent verifier

Review the final integrated diff after writers finish. Independently read the
acceptance criteria and inspect the result; exercise appropriate checks using
isolated fixtures where needed. Verify behavior and edge cases, not only the
implementer's report. Treat tests, builds and generated files as possible writes:
use a disposable checkout/output directory when a check could disturb shared work.

Return `PASS`, actionable `FAIL`, or `BLOCKED` with evidence, severity and location.
Missing credentials/platforms are blocked coverage, not a pass. Check that tests
or acceptance criteria were not weakened to conceal a failure. The coordinator
resolves findings and records the disposition; worker confidence is not a check.

## Authority

Delegation conveys only the assigned coding task. Workers do not push, publish,
merge, deploy, rotate credentials or configure network devices. The coordinator
handles already-authorized publication; live operations retain their separate
scope and applicable controls. Keep private credentials and topology out of reports.
