# Main consolidation — 2026-10-11

The owner authorized push, PR/merge, reconciliation of completed/superseded specs,
safe branch cleanup and return to main before Spec151. The publication hold stays
in force. This supersedes only the earlier instruction against merging.

## Accepted source and release boundary

The merge contains the recovered extension history through `e34db232`, including
the real WSL return `af660754`, plus current handoff/consolidation documentation.
Runtime and installer source remain byte-identical to base `f943637`. The source
version advances from 1.8.0 to prepared 1.9.0 under CONTRIBUTING/RELEASING, with
changelog, notes and README; no release-version tag or public release is created.
The independently versioned extension remains `NetClaw.netclaw@0.1.0`.

The accepted package and its SHA256 remain exactly those in
[mac-final-package.json](../artifacts/mac-final-package.json). Documentation and
repository release metadata changes do not alter its package inputs. T001–T022
implementation is complete. The final targeted actual WSL RAG confirmation remains
explicitly outstanding at consolidation; T023 publication is held. Use only the
[current final WSL prompt](../final-wsl-prompt.md), not old repair/full-matrix prompts.

## Git audit and disposition

No open PR existed at audit. Specs 144, 146, 147, 148 and 149 had already merged
through PRs #286, #288, #289, #290 and #291. Their remaining branch tips and all
other old completed local branches were confirmed ancestors of main. Those branch
names can be removed without losing source history.

The original Spec150 design/implementation/WSL/release/backend-experiment branches
contain unique superseded history and must not be merged into this client PR.
Their exact tips were preserved in annotated remote tags before cleanup. Deferred
specs 143 and 145 were likewise archived; they are not claimed implemented or merged.
See [archived-refs.json](archived-refs.json) for every full commit and tag.

The original owner's uncommitted USER.md publication preference was committed in
a detached preservation snapshot and pushed under the owner-publication-hold tag.
Its current authority is also recorded in the Spec150 documents on main. An old
detached Spec148 fixture checkout contained ten modified tracked files; those were
committed and archived without changing any working file bytes. Its ignored local
fixture/runtime data remains in place. Neither snapshot is merged into main.

The recovered extension-only and WSL handoff branches are ancestors of the final
implementation. They are removed only after their commits are reachable from the
merged main. Existing auxiliary checkout directories are retained, detached at
their preserved tips; no ignored state, virtualenv, dependency tree or credential
file is removed. The owner's normal checkout returns to clean main.

Remote and local branch cleanup is conditional on a fresh tip/ancestry check; any
concurrent unique work must be preserved rather than deleted. Archive tags are
not release tags. The non-release tag `spec150-main-handoff-20261011` pins the
merged source and this handoff. PR/main CI and the final Git state are verified
after merge and recorded in GAIT and the session report.

## Verification

Existing exact-artifact test/editor/platform results remain in mac-final.md and
wsl-followup.md. This consolidation changes no extension product bytes. Local checks passed: spec artifacts (134 specs, four legacy exceptions), all six
MCP declaration surfaces, release metadata and its six tests, and the exact VSIX
digest/size/25-entry manifest. Runtime/installer/config/mobile/skills source matches
base f943637, and extension source matches e34db232. Applicable PR checks must pass
before merge; failed checks must not be bypassed. No Marketplace command or publisher credential
is needed. The milestone blog stays an unpublished draft for owner review.
