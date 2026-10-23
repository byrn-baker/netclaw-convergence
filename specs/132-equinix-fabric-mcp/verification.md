# Verification and release — spec132

## Feature checks

- 26 focused Python tests passed (policy, OAuth cache partition, Risk scoping,
  installer/setup regressions); evidence/tests.txt.
- Catalog, docs, dependencies, package references, portability and Meraki capability
  declarations passed. SDD and targeted equinix-mcp startup passed.
- HUD production build passed; Python/Bash/JS syntax and git diff --check passed.
- Release helper's six tests and 1.2.0 metadata validation passed.

## Merge-readiness follow-up

User authorized merge and Git versioning on 2026-09-29. Current main remains 1.1.0;
feature minor bump is 1.2.0. Full HUD test run exposed a pre-existing isolated fixture
that copied JS modules but omitted genie_parse.py, required by genie-parser.js.
Added that single fixture dependency; no production behavior changed. Full HUD and
Canvas checks rerun for release (results recorded in PR/CI).

Spec Kit workflow followed manually from checked-in instructions: spec/research,
plan/tasks, implementation and verification. No agent slash-command execution claimed.

## Live boundaries

NEEDS_LIVE_CREDENTIALS: Equinix OAuth consent/renewal, manifest/schema compatibility,
scoped provider reads and approved reversible write/read-back. WSL installer acceptance
pending. No native setup.exe source exists; no binary built. No live cloud mutation,
external ticket, or blog publication was used for validation. Primary-CI incident gate
and skill-led post-write verification limitations are documented in docs/EQUINIX.md.

Release rerun: all 288 HUD unit tests pass. Canvas Local/Lab policy test also needed
a canonical temporary root on macOS (`/var` aliases `/private/var`); its fixture now
uses realpath without weakening the production symlink guard. The targeted policy
test passes. Full Canvas harness rerun follows in PR CI.

All 27 Canvas suites and bundle-budget/build checks pass. The installer mock suite
also canonicalizes its temporary root for the same macOS path alias; 10 installer
tests and 1 Genie adapter test pass. These are fixture-only portability repairs.
