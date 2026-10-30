# Spec155 WSL installer qualification

Status: executed with remaining gates on 2026-10-25 from exact commit
`c3aa0951519a0be79db085f7092043ee1c97d830`. See [WSL results](evidence/wsl-results.json)
and the WSL section of [verification](verification.md). The qualification branch
is `155-comms-wsl-qualification-20261025`. T048 remains open: actual remote-editor
and isolated service-manager acceptance did not pass. Do not infer operational
readiness from the installer evidence.

## Preserve the running environment

Record the current branch/status and keep all uncommitted work. Fetch the handoff
commit and create a detached, separate worktree for it. Use newly named private
test homes and a separate setup state root; do not install over a running claw.
Read `AGENTS.md`, this file, `verification.md`, `coverage.json`, `tasks.md` and
`docs/COMMS-SETUP.md` before testing. Start/record the normal GAIT audit.

This is **installer testing only**. Preserve wsl-cml/wsl-viz and all existing
identities, certificates, tokens, enrollment, mesh state, budgets, routes and
shared policy. Do not re-enroll, reset keys, start model sessions, read devices,
send messages/calls, capture meetings, or start the coordinated network window.
Do not run the generic startup device-list command for this scoped task.
No `.env` export is needed. Use explicit fixture credentials only. Keep local
credentials, exports, private logs and unpack scripts out of Git and returned reports.

## Source and regression gates

Record the fetched SHA, distro, WSL/kernel, architecture, Python and Node versions.
Use a supported private Node 24.19+ (24.x) or 26.1+, not Node 25. Native executable
checks require an owned regular executable with one inode link; use a verified
private copy if a package-manager fixture is hard-linked. Keep the safety checks.

From the isolated worktree run:

```bash
python3 scripts/check-comms-catalog.py
python3 scripts/check-catalog-metadata.py
python3 scripts/verify-catalog-coverage.py
python3 -m unittest discover -s tests -p 'test_setup*.py'
```

In `extensions/netclaw-vscode`, run `npm ci`, `npm run check`, `npm run build`
and `npm test` using that supported Node. Record individual skips; they are not
passes. Do not weaken guards or alter pinned dependencies to make a test pass.

## Actual isolated runtime checks

Acquire the pinned runtimes/dependencies in new private homes. Set test runtime
paths explicitly; never point fixtures at existing runtime homes or their `.env`.
Enable the opt-in native tests only after observing the qualified fixture paths:

- `test_setup_comms_hermes.py`: actual selected Hermes plugin/SDK readback. The
  expanded SDK suite uses `NETCLAW_TEST_HERMES_EXTRA_SDKS=1` only after those
  pinned dependencies are installed. Matrix requires its actual WSL dependency
  check; Mac configuration-only evidence did not qualify that dependency.
- `test_setup_comms_native.py`: OpenClaw/Hermes native registry discovery for
  Twilio core and Zoom. Socket-denial hooks must remain in place.
- `test_setup_comms_discovery.py`: actual timeout, output-flood and supervisor-loss
  cleanup with exact Linux process birth identity; preserve the neighbor process.
- `test_setup_comms_zoom.py`, `test_setup_comms_voice.py`, and
  `test_setup_comms_twilio.py`: real SDK contracts using fake accounts, inert
  discovery and bounded loopback lifecycle fixtures. No provider operations.
- `test_setup_comms_acquisition.py`: opt-in fresh acquisition for both runtimes,
  using `NETCLAW_TEST_COMMS_ACQUIRE=1`, a new private
  `NETCLAW_TEST_COMMS_ACQUIRE_ROOT`, and explicit `NETCLAW_TEST_NODE` /
  `NETCLAW_TEST_UV`. This tests four component installs across two fresh homes.
- `test_setup_comms_hermes_owned.py`: explicit
  `NETCLAW_TEST_HERMES_OWNED_ACQUISITION=1` enables real frozen dependency
  acquisition and shared configuration effects. Its Buzz binary is a declared
  compiled fixture, not an actual Buzz provider qualification.

Run a real engine installation from an empty Focused home for each runtime with
two placeholder channels. Verify source/runtime/dependencies, private credentials,
configuration, MCP registration and both channel effects. Empty sender scope must
stop before any service manager write/start and report configuration-required.
Do not turn this expected negative case into a provider-connection test. Check
cancel/resume, missing receipts, changed ownership and retained channel settings.
For owned service behavior, use the controlled service fixtures with synthetic
process/status evidence; do not substitute fake status as real provider transport.

Inspect the isolated VS Code Comms view with both runtimes, multiselection, Twilio,
Zoom and WhatsApp search, member/Border restrictions, keyboard operation and the
redacted report. Record what was actually observed, separately from unit tests.

## Results and fixes

Update `verification.md`, `coverage.json` and the WSL status here with exact tests,
passes/skips/failures, runtime versions, source SHA and preserved-neighbor evidence.
Keep configuration, authentication, transport, inbound and outbound distinct.
Personal-account QR flows remain unpaired unless a separate exact account-linking
instruction is supplied; synthetic receipts are contract evidence only. Real
Twilio operations remain excluded. Missing platform/provider prerequisites stay open.

If a source fix is necessary, make it in a separate qualification branch/worktree,
test it, and return the changed files, commit SHA and evidence for Mac reconciliation.
Do not merge, publish a release, deploy into existing homes or declare 100% while
required gates remain open. Return a concise summary plus paths to the sanitized
artifacts; never include credentials or raw provider output.

## WSL execution notes — 2026-10-25

- Ubuntu 26.04 / WSL2 x64, system Python 3.14.4; SHA-256-checked private Node
  24.19.0 with a single-link owned executable. Host uv 0.6.14 selected a Python
  3.14 alpha and the Hermes installer refused it. Private uv 0.9.5 acquired stable
  Python 3.14.0 in another empty home. Neither system tool was upgraded.
- Install the committed HUD lockfile (`npm --prefix ui/netclaw-visual ci`) as well
  as extension dependencies before the extension suite; its fixtures import HUD
  packages. The private Python test interpreter needs jsonschema and cryptography.
  `NETCLAW_SETUP_CERT_PYTHON` must actually have cryptography 46.0.5; the Zoom SDK
  interpreter uses another locked version and is not a substitute.
- Actual acquisition must replace the generic macOS/ARM sample-plan host with
  `host_identity()`. The corrected test now selects the WSL Zoom lock. Keep
  `WSL_DISTRO_NAME` in the otherwise sanitized test environment.
- Full Python suite: 268 tests, 261 passed, seven explicit skips. Four actual
  component acquisitions passed separately. Extension: 146 tests, 137 passed,
  six failed, three skipped. The six failures require an accessible user service
  manager; this isolated environment deliberately did not inherit that access.
  They remain failures, not retroactive skips. See the JSON for every skip/failure.
- Both real engines verified eleven effects including Slack/Discord configuration
  and refused service activation for empty sender access. Final read-only
  verification ran and remained unverified. The private runner's assertion that
  verification stayed pending was wrong; the original journals were retained and
  the actual postconditions checked read-only, without a rerun or fabricated receipt.
- `preview-setup.mjs` is a local macOS preview harness. An actual Linux desktop
  editor in WSL is not a WSL remote extension host and correctly fails the host
  gate. Private Windows 1.109.0 launch attempts did not establish the remote host
  (direct development launch exited 255 without a useful diagnosis). Do not count
  those attempts as visual, keyboard, role-selection or report acceptance. No
  host guard was weakened and no ordinary editor extension was installed/replaced.
- Preserve the remaining gates, including the three separately acquired native
  OpenClaw package fixtures, isolated systemd/Specify fixtures, positive service
  acceptance and Mac reconciliation. Do not start existing stopped distributions
  or borrow their enrollment merely to complete a test.
