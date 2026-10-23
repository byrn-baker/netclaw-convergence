# Windows / WSL candidate validation — 2026-10-11

**Partial validation; T022 remains open. Do not publish this result as WSL acceptance.**
The exact incoming VSIX installed and activated in the real WSL extension host.
Developer checks passed. The designated existing NetClaw HUD API is unavailable,
so real connection, provider, RAG and interactive assistant workflows are blocked.
The owner explicitly instructed: **“Use this installation; record live checks as
blocked.”** No replacement backend was used for live acceptance.

The portable sanitized [check report](wsl-checks.json) records counts, versions,
artifact verification and preservation limits. Raw logs remain private.

## Source and artifact

| Item | Observed value |
| --- | --- |
| Incoming branch | `origin/150-vscode-extension-only` |
| Exact incoming commit | `c21b4f802ee7909bfb9ee1e258b0e5c668702f0d` |
| Implementation source recorded by Mac | `8db2c2144e169f4c2ab832d3d62c40f1b1c6a807` |
| Isolated validation branch | `150-vscode-extension-wsl-20261011` |
| Isolated checkout alias | `WSL_VALIDATION`, a new worktree on ext4 under Linux home |
| Package | `artifacts/netclaw-0.1.0.vsix`, `NetClaw.netclaw@0.1.0` |
| SHA-256 | `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005` |
| Size / archive | 2,220,783 bytes; 24 ZIP entries |
| Installed payload comparison | All 21 non-manifest `extension/` files byte-identical; package manifest identical after excluding editor-added `__metadata` |
| Artifact changes | None; incoming VSIX retained, no replacement VSIX packaged |

The existing service checkout, `OWNER_SOURCE`, stayed on `150-vscode-extension`
at `aa2795313b487e00ccbe85d53f6a78db07b10a94`, source VERSION 1.8.0. Its local
testbed edits and backup were preserved. This disk revision does not prove the
loaded revision of every service. No extension defect was confirmed and no source
fix was made. This return changes Spec150 documentation/evidence only.

## Host and client observations

| Item | Observation and limit |
| --- | --- |
| Windows | 26H2, build 26300.9550 |
| WSL | 3.0.1.0, WSLg 1.0.79, kernel 6.18.40.1-microsoft-standard-WSL2 |
| Distribution | Ubuntu 26.04 LTS, x86_64; private distribution label omitted (its label is older than the installed OS) |
| VS Code desktop / server | 1.140.0, commit `07f806f999227108933c2e30515b26eecc1fda74` |
| Remote WSL extension | 0.104.3 |
| Actual extension host | Linux executable under the WSL `.vscode-server` installation; `remoteexthost.log` records `NetClaw.netclaw` activation at 07:20:32 EDT |
| Owner Node | 25.1.0; outside the documented supported HUD Node range; left unchanged |
| Validation Node | Existing isolated 24.19.0 executable; selected only for checkout-local npm/build/test processes |
| Owner runtime | Installed OpenClaw package 2026.6.11; running gateway service observed; no live identity/readiness response from the unavailable HUD |
| Python | System 3.14.4; no new Python installation or backend runtime qualification |
| Claude Code | Actual CLI 2.1.288; installed editor package 2.1.296; `mcp --help` exits 0 |
| Codex | Actual CLI 0.162.1; installed editor package 26.1007.21434; `mcp --help` exits 0 |
| Copilot | Installed built-in `GitHub.copilot-chat` 0.68.0; interactive account/consent/inference untested |

Version/presence checks do not establish assistant authentication, policy or tool
execution. No assistant registrations or approval settings were changed and no
provider request was submitted.

## Existing installation prerequisite failure

The existing `netclaw-hud.service` declares the Express API on loopback port 3001
and Vite frontend on port 3000. Its wrapper remains active, but the API subprocess
exited. Bounded GET `/api/runtime` on port 3001 failed to connect. Port 3000 is
listening, but its API proxy requests timed out. The HUD journal reports:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@modelcontextprotocol/client'
... imported from .../ui/netclaw-visual/src/hud-server/runtime/hermes.js
Node.js v25.1.0
node server.js exited with code 1
```

This is an existing installation prerequisite, not evidence of a VSIX defect.
The API remains unavailable after the interruption/resume. No dependency repair,
backend upgrade, service start/restart, identity initialization or credential change
was attempted. The former secondary Hermes test API was also not listening; its
historical results were not substituted for this target.

## Handoff matrix disposition

Each row corresponds to the final Windows/WSL handoff. A partial or blocked row
does not close that checkbox.

| Handoff check | Actual result |
| --- | --- |
| Exact VSIX installation / WSL execution | **PARTIAL PASS:** actual WSL CLI install exits 0, inventory reports 0.1.0, installed bytes match and remote extension-host log records activation. Separate editor-driver observation is reported below. |
| Add connection / identity / Windows-local refusal | **BLOCKED** for real target: identity API unavailable; no installation or harness was pinned. Windows-local operational refusal was not interactively exercised. |
| Populated domain panels | **BLOCKED:** no bound real connection; no empty inventories described as healthy. |
| Real provider Chat / history / context / model choice | **BLOCKED:** no real provider request, session or conversation created. |
| Canvas / Avatar / import-export / stale and uncertain views | **NOT RUN** against real target; source-suite transport/uncertainty checks are separate fixture evidence. |
| RAG search / reviewed fixture upload / indexing / citation | **BLOCKED:** no owner document uploaded, removed or reindexed. Optional isolated RAG test skipped. |
| Environment/budget cancellation / isolated replacement / service staging | **BLOCKED** in real editor against owner API. Isolated unchanged-HUD fixture covers replacement/preservation; source test covers identity-bound shell staging. No owner write or lifecycle command executed. |
| Both existing harnesses | **BLOCKED:** owner API unavailable; secondary historical Hermes API not running. Hermes fixture tests do not prove live companion/provider execution. |
| Interactive Copilot | **BLOCKED:** no bound real installation; opt-in, status, inspect, inert proposal, consent, delegation/result and cached-call revocation not exercised in Copilot. |
| Interactive Claude Code | **BLOCKED:** same prerequisite; CLI/version presence only. Mac result does not qualify WSL. |
| Interactive Codex | **BLOCKED:** same prerequisite; CLI/version presence only. Approval controls were not relaxed. |
| Reload / reconnect / pending review / mismatch / untrusted / distribution isolation | **NOT QUALIFIED:** the host interruption was unplanned and had no connected/pending extension operation. It is not a controlled WSL restart test. No second user distribution or Remote SSH test. |
| Installed upgrade / disable / re-enable / uninstall in isolated profile | **BLOCKED:** isolated Windows editor launch exits 1 because its update mutex is held. Exact install is proved; upgrade/disable/re-enable/uninstall unrun. |

### Actual editor installation and independent launch

From the isolated WSL checkout, the actual remote CLI commands were:

```sh
code --install-extension "$PWD/specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix" --force
code --list-extensions --show-versions
```

Installation exited 0 and reported successful installation into WSL. The remote
agent recorded extraction into the WSL extension directory, and the Linux remote
extension host recorded `ExtensionService#_doActivateExtension NetClaw.netclaw`
with `onWalkthrough:netclaw.getStarted`. This establishes actual packaged activation;
it is not a visual **Show Running Extensions** check or a connected panel check.

A separate native Windows `Code.exe` launch used private user-data/extensions
directories, profile `Spec150Isolated`, the existing WSL support extension, the
intended WSL remote authority, the isolated checkout, and a temporary workspace
test driver. The driver was intended to inspect the installed extension through
VS Code APIs and exercise refusal of the unavailable real owner API. It **never
ran**: VS Code waited 30,776 ms and exited 1 before creating the test window:

```text
checkInnoSetupMutex: vscode-updating still held after 30776ms, giving up
Error: Code is currently being updated. Please wait for the update to complete before launching.
```

The update mutex was not bypassed and the owner window was not closed. An earlier
launch sharing the owner's user-data directory was refused because another Code
instance was running; subsequent attempts used isolated directories. No driver
result or screenshot exists, and none is claimed. No synthetic older package was
installed and no disable/uninstall operation ran against the owner extension.

## Developer checks (fixture scope)

Using the existing Node 24.19.0 executable prepended to a **quoted** process-local
PATH, in the isolated checkout:

```sh
npm --prefix ui/netclaw-visual ci --ignore-scripts
cd extensions/netclaw-vscode
npm ci --ignore-scripts
npm run check
npm run build
npm test
```

All commands exited 0. Both dependency installations reported zero audit
vulnerabilities at execution. **17 tests: 16 passed, 0 failed, 1 skipped.** The
skipped test is opt-in local RAG indexing/retrieval. Check/build output was not used
to replace the incoming VSIX.

The suite exercises bounded URL/identity transport, cross-target behavior,
uncertain submissions without replay, assistant tool denial, inert proposals,
cached-registration refusal, request-ID deduplication, shell quoting and identity
checks, Hermes ownership/nonce/status/stop fixtures, unchanged HUD routes and
official bundled MCP stdio. Its isolated HUD uses a synthetic local gateway;
reported external provider and network-device calls are zero. These results are
not real installation, interactive client or desktop UI acceptance.

## Preservation and interruption

Private baseline hashes/modes cover eight paths: repository dotenv, owner runtime
dotenv/configuration, modified testbed and backup, selection descriptor, and Claude
Code/Codex configuration. The absent selection descriptor remained absent. All
eight observations matched after resume. Unrelated assistant registrations stayed
unchanged. No production/network configuration, peering, approval or ticket change.

The initial snapshot includes fifteen relevant user services. At resume the host
reported boot time **2026-10-11 07:26:03 EDT** and service PIDs/start timestamps
changed across the interruption. This session issued no WSL shutdown, restart,
service restart or upgrade command. Therefore continuous PID/uptime preservation
across the complete session cannot be claimed. A fresh post-resume snapshot was
captured for the remaining checks. The pre-existing failed DNS-over-TLS service
was active on resume; no repair was performed by this validation.

At the final snapshot, all eight file observations still matched and eleven of
fifteen service records matched the post-resume snapshot exactly. The gateway,
HUD wrapper, mesh, four member services and security services retained their
post-resume identities. Four records changed: two DDNS services were activating,
the heartbeat service had a newer execution timestamp, and the Zoom RTMS service
reported `activating/auto-restart`. These observed transitions were not initiated
or corrected by this session and are not described as a service-health pass.

- Private initial snapshot SHA-256: `5e2c87170c5950df229e22b8303f0caab9a5d68a56326bc09fdc653780e5d350`
- Private final snapshot SHA-256: `2a4ad3d9d51fd7d81346d0a3095fd744b474ce059e9121e29b180b2e4e4e1c2e`

Exact VSIX installation is an intentional editor-side change. It remains installed
in the owner's WSL extension inventory. Isolated checkout dependencies and private
test/audit files remain local. Private raw responses, paths, process records, logs,
configuration fingerprints and audit history are excluded from Git.

## Audit and next action

GAIT session: `spec150-exact-vsix-wsl-20261011`, initialized in an owner-private
cache directory with a session-specific sticky-root file. Startup and significant
milestones were recorded through the actual GAIT MCP server. Startup
`pyats_list_devices` completed with five inventory entries; no device health or
configuration operation followed. MemPalace discovery failed with “Component
unavailable”; neither recall nor diary success is claimed. Daily notes are retained
locally. No external ticket/message, merge or publication was performed.

Session startup record: `fbce5945`; artifact/prerequisite milestone: `6a9a24b9`;
tests/resume milestone: `da2ea403`. The final summary and `gait_log` are retained
in the private session audit directory, not transferred through Git.

Mac review must retain T022/T023 as open. A separately reviewed existing-installation
prerequisite correction is needed before returning to the blocked live matrix.
Keep the incoming VSIX digest and repeat actual Windows/WSL and all three interactive
assistant checks after that prerequisite is met. See [Mac return](../mac-return.md).
