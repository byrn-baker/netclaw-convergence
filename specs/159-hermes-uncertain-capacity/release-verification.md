# Coordinated patch verification — Specs 156–159

2026-10-29. Owner requested the four issues in chronological order, then explicitly
requested a build increment, minor-fix history notes, and issue replies/closure.
Source 1.13.1 batches the four fixes. Extension source 1.3.1 records its setup
review-input correction; no Marketplace publication is part of this source patch.
Existing runtime homes, providers and devices remain unchanged.

## Local gates

- Individual regressions and SDD evidence: see each spec's verification.md.
- Full HUD unit suite: 383 passed; HUD production build passed.
- Extension check/build passed; 143 passed / 146, three declared opt-in skips.
- Hermes bridge/ledger/protected-agent suite: 24 passed / 30, six native-runtime
  opt-in skips. Federation compatibility: 25 passed / 29, four opt-in skips.
- Final configuration/registration sample: 102 passed / 103, one native resolver
  opt-in skip; four additional subtests passed. The actual native resolver was
  already exercised separately for Spec156, not replaced by that skip.
- Release helper: six tests passed; release metadata, 142-spec artifact check,
  skill descriptor parity (237) and generated catalog parity passed.
- All six declaration-reconciliation surfaces pass in a clean tracked-source
  worktree at 3966c5d. The owner's existing checkout reports an unbounded MCP pin
  in ignored/untracked humanrail-mcp-server. That independent local clone remains
  untouched; no exception or warning-only bypass was added to hide its finding.

The first ad-hoc federation command lacked pytest; a subsequent environment
lacked websockets/MCP. The final isolated Python3.12 environment includes the
qualified FastMCP4.0.11/MCP2.3.0 dependencies and all selected tests pass/skips as
reported above. No installed owner environment was changed to run checks.

## Publication gates

Push the committed source, merge through a PR only after applicable CI succeeds,
verify exact merged-main workflows, then tag the same commit as v1.13.1 and
publish its source release after tag validation. Reply to and close #262, #300,
#301, #302 in chronological order with fix/spec/test/upgrade details. Publication
is not claimed by this preparation file; final URLs/receipts belong in local
memory and GAIT. No live provider/device qualification or Marketplace release is
implied. Existing platform limits and HUD chunk-size advisory remain.

Initial PR307 CI:34/35checks passed, including six real pinned-Hermes controlled-
provider tests, HUD383tests and extension packaging. The remaining unit failure
was an old fallback-string expectation in test_installer_followups.py; corrected
under Spec156 and rerun without bypassing CI. Official MCP stdio also verified
all eight tools and the optional boolean recovery argument; no runtime tool ran.
