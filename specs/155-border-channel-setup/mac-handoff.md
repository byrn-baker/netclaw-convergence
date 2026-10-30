# Spec155 Mac reconciliation handoff

Mac reconciliation returned on branch `155-comms-mac-reconciliation-20261025`; see
[verification](verification.md) and [Mac results](evidence/mac-reconciliation-results.json).
Mac installer scope is complete with recorded limits. Overall Spec155 remains
incomplete because T048 WSL gates are open. This handoff remains below as history.

The WSL qualification branch is `155-comms-wsl-qualification-20261025`.
Its qualification evidence commit is
`2e3023f7ad7d1b81e19bd1d6147d99a929b4f4ff`, based on the requested source
`c3aa0951519a0be79db085f7092043ee1c97d830`. This document is an additive handoff;
it does not change any test outcome or close a qualification gate. Use the exact
remote tip SHA supplied with the return prompt when creating the Mac worktree.

## Read first

- `AGENTS.md`, `SOUL.md`, `USER.md` and `TOOLS.md`
- [WSL handoff and execution notes](wsl-handoff.md)
- [Verification](verification.md), especially the WSL qualification return
- [Coverage](coverage.json) and [tasks](tasks.md)
- [WSL results](evidence/wsl-results.json) and
  [preservation limits](evidence/wsl-preservation.json)
- [Comms setup](../../docs/COMMS-SETUP.md)

## Continue on Mac

Fetch the supplied exact SHA from the qualification branch and verify it before
testing. Preserve the current Mac checkout and all uncommitted work. Create a
separate Mac reconciliation worktree/branch, private setup state, fresh runtime
homes and isolated editor profiles. Start/record GAIT. For this installer-only
task, do not run the generic startup device inventory.

Review the three WSL test changes: observed-host selection for actual acquisition,
Matrix's real SDK assertion, and the concurrent adapter test's valid durable-status
readback schedule. The last still requires exactly one chat submission. These
are test corrections; no production implementation or dependency pin changed.

Run the documented catalog/schema checks, full Python setup suite, extension
typecheck/build/tests, and appropriate actual isolated OpenClaw/Hermes installer
checks against the reconciled source. Use supported private Node and explicitly
qualified runtime/SDK fixtures. Install both extension and HUD dependencies from
their committed locks. Record skips and failed fixture preparation separately.

Continue T047's remaining Mac acceptance: both runtimes, multiple Comms choices,
role placement/restrictions, dependency acquisition, native discovery, ownership,
access refusal, cancel/resume and recovery, retained settings and preservation of
neighbors. Inspect the real isolated Mac VS Code setup flow, keyboard operation
and redacted report. Keep synthetic process/status/pairing/callback evidence
separate from actual installation and provider behavior. Service acceptance must
use controlled local fixtures; fixture credentials cannot establish live provider
authentication or delivery. Do not activate a provider connection to fill a gate.

Review T050's cross-artifact/source audit and milestone draft using the combined
evidence. Update verification, coverage and task states only when their stated
evidence exists. Commit and push scoped fixes/evidence on the separate Mac branch,
then return its exact SHA, checks, preservation results and remaining gates.

## WSL facts to retain

- Actual Ubuntu 26.04 WSL2 x64; the registered distribution name was
  `Ubuntu-22.04`. Private Node 24.19.0 and uv 0.9.5; stable Hermes Python 3.14.0.
- Python: 268 tests, 261 passed, seven skipped. The separately enabled fresh
  acquisition test passed; three external/personal OpenClaw package fixtures,
  two disposable-systemd fixtures and Specify remain skipped in the final run.
- Extension: 146 tests, 137 passed, six failed, three skipped. All six failures
  report unavailable user service manager in the isolated environment. They
  remain failures; shared-manager access was not added to force a pass.
- Both actual fresh engines verified eleven effects including Slack/Discord.
  Empty sender access refused service activation; final read-only verification
  remained unverified. The private wrapper's pending-verification assertion was
  wrong; journals were retained and actual postconditions checked read-only.
- Four actual Twilio/Zoom acquisitions and four inert native registry discovery
  combinations passed. Hermes SDK acquisition preserved all 93 existing package
  versions while growing to 155; Matrix import/readback passed on WSL.
- Actual WSL remote VS Code acceptance is open. A local Linux window is not a WSL
  remote extension host. Private Windows launch attempts did not establish that
  host. Mac acceptance cannot close this WSL gate.
- Preservation snapshots matched 8,138 selected files, 99 logical database tables
  and ten service PID/start identities. Original branch/testbed work was intact.
  Another 52 policy/configuration files had only a post-run mtime check. The names
  `wsl-cml` and `wsl-viz` were not located in the observed roots; no per-name hash
  preservation is claimed. Stopped distributions were not started.

T047, T048 and T050 remain open. Do not turn WSL environment failures into passes,
replace actual editor acceptance with frontend tests, or infer installed plugins
from source-only schema validation. Configuration, authentication, transport,
submission and delivery are distinct. Prior Mac provider authentication does not
qualify the new fixture installations.

## Scope boundaries

Use fixture credentials; no environment export is needed. Preserve existing
Mac/WSL installations, identities, certificates, enrollment, tokens, mesh state,
budgets and shared policy. No re-enrollment, key resets, model sessions, device
reads, messages, calls, meeting capture, account pairing or coordinated network
window. Keep credentials, raw logs, private runtime homes and unrelated testbed
edits out of Git. No merge, release, Marketplace publication or deployment into
existing installations is authorized. Keep `complete: false` while required gates
remain open.
