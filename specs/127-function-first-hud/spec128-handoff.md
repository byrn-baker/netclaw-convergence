# Ready for spec 128

## Release authorization and current state

The user explicitly authorized committing, pushing, creating a PR, merging,
deleting the feature branch and returning to main on 2026-09-28. This supersedes the
earlier hold-for-review instruction; do not ask for the same approval again.

The current environment blocks the release: `git add` cannot create
`.git/index.lock` (Operation not permitted), and `gh repo view` cannot connect to
api.github.com. No commit, push, PR, merge, branch deletion or main checkout was
performed. Working branch remains `127-function-first-hud`; preserve its local work.
PR description: [pr-description.md](pr-description.md).

## Complete the authorized release in a permitted session

1. Inspect status/diff and ensure the known spec127 files are the intended changes;
   preserve unrelated changes if any appeared since this handoff.
2. Stage the spec127 HUD/server/federation changes, docs/reference artifacts,
   tests, .env.example/README/TOOLS/USER notes, reference builder and scoped HUD
   upgrade helper. Commit with a descriptive function-first HUD title.
3. Push `127-function-first-hud`, create the PR against main using
   `--body-file specs/127-function-first-hud/pr-description.md`, and inspect CI.
   The two previously sandbox-blocked listener tests must run in CI.
4. Merge with a merge commit after required checks pass, delete the remote/local
   feature branch, switch to main and pull fast-forward. Check the resulting status.
5. Record the actual PR URL, merge commit and verification outcome in GAIT/memory.
   Do not mark any step successful based on this plan alone.

## Spec 128 scope is not decided

The user has additional plans and thoughts to discuss after the HUD release. Do not
invent requirements or assume 128 is the general upgrade utility. That utility is
still planned from spec126 and can reuse the new scoped HUD helper, but its number
and scope need the user's direction. No spec128 implementation has started.

Carry forward: full Canvas preservation, honest observed/configured/estimated state,
Jev task ownership, fixed-source logging and safe configuration views. Remaining
cross-host/live-browser acceptance is listed in verification.md. The static API/CLI
reference's documented limits must not disappear in the next spec.
