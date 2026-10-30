# Spec155 release verification — 2026-10-25

The owner explicitly authorized commit, PR, merge, completed-branch deletion,
return to main and production publication after the Mac reconciliation. This
supersedes the earlier source-only hold. Source **1.13.0** and extension **1.3.0**
ship the Comms installer with the recorded limits; existing runtimes remain unchanged.

## Accepted scope

[Mac reconciliation](verification.md) is based on WSL return
`04645395530a060b35404ec3a27bc516ae9ba076`; scoped Mac fixes/evidence were committed
as `b0da658d0769b69dd01ec8808c4dfc0061320ad0`. Release preparation incorporates
current main's Forward MCP change and regenerates catalog/effect source hashes.

T047 and T050 are complete for the recorded installer-only scope. **T048 remains
open; overall qualification is 49/50, not 100%.** Six WSL service-manager failures,
genuine remote-editor acceptance and remaining fixtures are preserved. Controlled
service/review responses are distinct from native provider readiness. The actual
redacted reports were inspected without exercising the product report/export
controls against the isolated journals. No provider operation is part of publication.

## Release preparation and distribution gates

The release updates source/extension versions, lock metadata, minimum source guidance
and package provenance. It registers the Python setup family in the contract-test
matrix so a green PR also runs the ordinary Comms regressions; optional installed
runtimes and provider checks remain explicit skips without their isolated fixtures.

Before publication, release metadata, SDD artifacts, declaration reconciliation,
catalog generation, affected Python tests, extension check/build/tests and dependency
audit must pass. Applicable PR and exact merged-main workflows must pass; no failing
checks are bypassed. The exact committed VSIX must include all setup/Comms/skill/preset
assets and pass actual installed-extension acceptance in fresh isolated VS Code
profiles. These package checks are distinct from the earlier source-extension tests.

Publication receipts will record source commit, VSIX SHA-256, installed payload
verification, PR/merged-main/tag checks, GitHub release/tag identity and public
Marketplace version plus downloaded archive equality. Final receipts are release
assets and local audit records so they do not mutate the tested package. Publication
is not claimed by this preparation document until those receipts exist.


Preparation checks passed: six release-helper tests, 138 spec artifact records,
all six declaration-reconciliation surfaces, generated skill/catalog parity,
77-entry Comms validation and zero unexplained catalog gaps. Refreshed extension
check/build and **143/146 tests** passed (the same three explicit skips); npm audit
reported zero vulnerabilities and publisher credential verification succeeded.
The new clean-environment installer CI harness passed **236/268 tests**, with 32
native/runtime/acquisition/manager opt-in skips and zero failures. Its Python 3.12.12,
jsonschema 4.26.0 and cryptography 46.0.5 environment is isolated. This offline count
is separate from the qualified Mac **261/268** run and its separate opt-in passes.
