---
name: convergence-development
description: Advance Convergence coding, documentation and upstream-readiness tasks using scoped sub-agents and bounded Ralph-style iteration. Use for developing or reviewing Convergence, not operating an installed stack.
---

# Convergence development

Read `CONTRIBUTING.md`, `.specify/memory/constitution.md` and the active numbered
spec's `spec.md`, `plan.md`, `tasks.md` and `verification.md` from the checkout
being changed. Update the spec before implementing changed scope. Preserve the
separation between the fork implementation and upstream's proposed scope.

## Review-only requests

If the user requests review without implementation, inspect the diff and acceptance
criteria, run only permitted checks, and use the independent verifier contract in
[role contracts](references/roles.md). Report findings and coverage gaps directly;
leave source files, task completion and the ledger unchanged unless the request
also authorizes a written review artifact. Use isolated outputs for checks that
write files. Do not enter the implementation loop or fix findings in this mode.
Apply the role concurrency limit and any user time limit; default review budget
is 45 minutes. Finish when the requested review is complete or that limit is reached.

## Implementation requests

1. Identify the requested outcome, checkout/branch and outstanding acceptance
   criteria. Inspect the current diff and preserve existing user work. If the
   request is to install or operate services, route to
   [convergence-setup](../../../workspace/skills/convergence-setup/SKILL.md).
2. Read [the iteration procedure](references/loop.md). Record a run ledger in the
   active spec's `verification.md` before changes. Resume an existing run from its
   ledger rather than resetting its budget when context is lost.
3. For independent research, disjoint implementation or independent verification,
   read [the role contracts](references/roles.md) and delegate through the coding
   host's sub-agent tools. Keep trivial single-file work local. If the host lacks
   delegation, proceed sequentially and record that review was not independent.
4. Follow the iteration procedure until acceptance passes or a stop condition
   applies. Return the change, executed evidence, remaining gaps and ledger path.

This skill runs within the current coding session. It starts no daemon and installs
no runtime agents. Its limits are instructions to the coordinator, not enforced
process timeouts or a monetary-spend cap. Honor the current session's authorization;
use isolated fixtures for verification and keep live operations out of a coding task.
