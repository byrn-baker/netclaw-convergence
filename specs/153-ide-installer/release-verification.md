# Spec153 release verification — 2026-10-24

The owner authorized merge, publication, completed-branch cleanup and return to
main after the requested three additional Mac installer passes. This supersedes
the earlier source-only/publication holds. Source **1.12.0** and extension **1.2.0**
carry the installer; existing owner runtimes remain unchanged.

## Accepted scope and evidence

The accepted additional Mac scope is installation from empty homes through verified
VS Code connection readiness. [Three scenarios passed](mac-return-installer-acceptance.md),
covering six actual installations, native cancellation, explicit checkpoint resume,
mixed Risk enrollment and authenticated hot-member self-status, preservation and
owned cleanup. No operational capability retesting was requested or performed.
The prior [Mac gate](MAC-COMPLETION.md) and [WSL return](../../spec153-wsl-return/SUMMARY.md)
retain their original evidence and limitations.

The tested implementation is `575bb084a8ca54c629b8f39434539cbd10597065`.
Release preparation also corrects the VSIX allowlist to include setup metadata,
assistant skill and deployment preset, with packaging-time completeness checks.
The dependency audit required Zod 4.6.7 and a publishing-only override to MSAL Node
7.1.0 under Azure Identity (its upstream range still selects vulnerable 6.x); these
changes receive fresh extension regression and installed-package checks.
The [sanitized record](evidence/mac-return-three-pass.json) binds actual outcomes,
plan/journal hashes, test logs and preservation checks. No private credentials,
raw journals or owner topology are included.

Mac regression: extension check/build and 136 tests passed (three explicit skips);
138 of 140 setup cases passed, including actual pinned Hermes and Specify checks
(two native WSL-only skips); 216 installer cases plus 16 subtests passed. Catalog
metadata, generated parity and coverage passed with zero unexplained gaps.

## Remaining qualification

T081 and T082 remain open for the incomplete actual Windows/WSL scenarios recorded
in the [return matrix](../../spec153-wsl-return/matrix.json). In particular, Ubuntu
24.04 Hermes setup was interrupted/unknown, and some client, actual cold-wake,
legacy CLI and native Windows gate cases were not completed. Fixtures do not
replace these cases. T084 closes the final coverage reconciliation; task count is
82/84, not a claim of complete platform coverage.

Native Windows runtime hosting remains unsupported. Production setup requires
qualified installation-bound controls; a release does not override that gate.
Existing installations are neither adopted nor upgraded by installing the extension.

## Distribution checks

The release uses VS Code >=1.109, source 1.12.0 and extension 1.2.0. Packaging must
start from committed source, include every runtime bundle and license notice, and
record the VSIX SHA-256/source revision. The exact archive must be installed in a
fresh isolated VS Code profile and its loaded setup entry verified before publish.
Applicable PR, merged-main and tag workflows must pass. Publication receipts must
confirm the public Marketplace version and downloaded archive digest, as well as
the GitHub release/tag commit. Final receipts are retained with the release assets,
daily memory and GAIT so they do not mutate the tested package.

Release preparation checks: TypeScript check/build passed; the refreshed extension
suite passed 136/139 with the same three explicit skips. Dependency audit reports
zero vulnerabilities, and publisher credential verification succeeded without
exposing credentials. All six reconciliation surfaces, 137 spec artifact records,
six release-helper tests and catalog coverage passed.
