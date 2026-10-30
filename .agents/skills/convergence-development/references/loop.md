# Bounded Ralph-style iteration

Here “Ralph-style” means repeat implementation and independent feedback against
one explicit acceptance target, retaining progress between attempts. It does not
mean a third-party plugin, an unattended subprocess loop or automatically creating
a fresh coding session on every iteration.

## Start or resume

Default budget: **three iterations per task and 45 minutes for the whole run**,
including delegates. Respect any tighter user budget. Record UTC start/deadline
and task attempt counts. Check time before each dispatch and before another
iteration; use the tool's timeout where available and stop outstanding delegates
when the deadline is reached. An interrupted session resumes with the original
counts/deadline; an expired budget requires the user's authorization for a new run.
Do not create an external persistent goal or scheduler merely to run this skill.

Use the active spec's `verification.md` for the durable ledger; reference task IDs
in `tasks.md`. Record acceptance before implementing, including any pre-existing
failures and which required checks apply. Test inventories/commands come from
`CONTRIBUTING.md`, `tests/contract-suites.json` and the changed component's current
configuration. Read the [qualification matrix](../../../../docs/convergence/verification.md)
when deciding what installation evidence exists; its historical passes do not
validate new runtime changes.

A compact ledger entry contains:

```text
Run ID / start UTC / deadline UTC / checkout / branch / starting commit
Task / acceptance / allowed files / delegates and ownership
Attempt N of limit / remaining time
Before: reproduction or documented acceptance gap
Change: files and behavior
Checks: exact commands, exit/results, evidence paths, unavailable coverage
Review: findings and disposition
Outcome: COMPLETE | RETRY | BLOCKED | BUDGET_EXHAUSTED
Next action and required input, if any
```

Keep transient logs in a private directory outside Git; commit only sanitized
evidence. Update the ledger after each attempt, before yielding or handing off.

## Each iteration

A cycle that executes acceptance checks consumes one attempt even if it only
rechecks a dependency and makes no source edit. Increment the task count before
its first check or implementation dispatch. Reading the ledger and inspecting
prerequisites without executing acceptance checks does not consume an attempt.
Repeated checks within that same cycle share the attempt and the run deadline.

1. Select one ready task from `tasks.md`; verify its prerequisites. If none can
   proceed, report the dependency instead of inventing additional work.
2. Capture the failing behavior or missing acceptance evidence. Delegate only
   independently useful parts using the role contracts.
3. Implement within the task's scope and file ownership. Wait for writers before
   integrating. Stop on an unexpected shared-file conflict and reconcile the work
   without discarding another contributor's changes.
4. Run the relevant acceptance checks. Record failures and missing dependencies
   explicitly. Obtain independent verification when tools are available; otherwise
   record the sequential self-review and leave any required independent review open.
5. Resolve each review finding as fixed, justified out of scope, or still open.
   Compare actual results against every required criterion, then record an outcome.

## Outcomes and stopping

- **COMPLETE:** all required acceptance checks for this task pass and required
  review findings are resolved. Mark only that task complete. Continue to the next
  ready task within the user's requested scope and remaining run budget, or finish.
- **RETRY:** a concrete unresolved failure has a new evidence-backed hypothesis,
  the fix is in scope, and the task/run budget allows another attempt. Record the
  hypothesis; the next cycle increments the count once before checks or dispatch. Completion claims
  or a checkbox alone never trigger success.
- **BLOCKED:** required credentials, platform, maintainer decision, authorization
  or another dependency is unavailable; or two consecutive attempts leave the
  same failure with no new evidence. Report the exact dependency and next action.
  Other independent, authorized tasks may proceed within the same run budget.
- **BUDGET_EXHAUSTED:** attempt limit or deadline reached. Stop the task/run as
  applicable, retain partial changes and evidence, and report remaining work.
  Do not silently reset counts or broaden scope. User-authorized continuation can
  establish a new budget linked to the prior run.

A new CI failure is investigated before it is labeled inherited. Record the base
comparison when it is inherited. Never weaken tests, erase findings, reset user
changes or treat an unavailable check as passing to exit the loop successfully.
