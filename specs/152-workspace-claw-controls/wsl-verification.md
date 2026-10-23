# Spec152 WSL workspace inspection — 2026-10-15

The real regular-file editor works in the Windows renderer with a WSL extension
host. This is **not full release qualification**: four real workspace files are
symlinks and are refused, and five full-lifecycle fixture tests fail closed when
they encounter this host's existing systemd environment-file configuration.
No merge, push, publication, live deployment or live lifecycle action occurred
during the inspection. The owner subsequently authorized committing and pushing
the WSL follow-up on 2026-10-16 for continuation from the Mac.

## Continue on the Mac

Fetch the WSL follow-up branch, which includes the original candidate and the
source corrections described below:

```sh
git fetch origin
git switch --track origin/152-workspace-claw-controls-wsl-20261015
```

If continuing on an existing feature branch, merge the fetched WSL follow-up
there instead. The committed 1.1.0 VSIX is unchanged; the source HUD/helper must
include this branch's corrections. Review the qualification limits below before
the separate live release step.

## Candidate and platform

- Source fetched: `59ae9c40`, from `origin/152-workspace-claw-controls`, into a
  separate Linux-filesystem worktree. Local fixes are on
  `152-workspace-claw-controls-wsl-20261015`.
- Exact committed NetClaw **1.1.0** VSIX: 4,225,859 bytes;
  SHA-256 `0f8ac4bd8bd9bd64c9198ea66ec501a81c1f8b17c02f736ab0e5dd613b28b75d`.
- Active extension bundle:
  `c262b80dbc146ca0aef6735c0cadb8393b6858aaf9c1bb498741bf7adfeb4a0f`.
  The bundle was extracted from the candidate and its loaded module path was
  verified in the extension host. It was not rebuilt or installed over the normal
  editor extension.
- Windows VS Code **1.140.0**, existing portable test installation; actual guest
  **Ubuntu 26.04 LTS**, WSL2 kernel `6.18.54.1-microsoft-standard-WSL2`.
  The distribution registration name says Ubuntu-22.04 and is not the OS version.
- Private Windows user-data/extensions directories and a separate WSL server data
  directory. A named Windows profile alone did not isolate remote extension file
  storage. The initial preview-only connection/selection was removed from normal
  storage before using the separate remote server. A temporary conditional server
  startup hook was restored to its original absence.
- Source HUD API only, on a separate loopback port, using the pre-existing real
  OpenClaw installation identity and native `agents list --json` workspace. The
  gateway, original HUD and federation continued running.

The installed Windows editor had an updater mutex, and Windows C: was initially
full. Two prior portable-editor download ZIPs were relocated into private WSL
storage with matching SHA-256 checks (511,131,869 bytes preserved). The existing
portable editor avoided changing the installed editor or updater. An existing
Node 24.19.0 binary was copied into private preview storage because its original
NPM location was hard-linked; executable hard-link checks were retained.

## Native observations

The native local-management dialog displayed the actual installation, workspace,
source checkout and helper hash before binding. Source text was not logged or
uploaded. The preview remains open with SOUL.md and Workspace & Claw side by side.

| File | Observed result |
| --- | --- |
| SOUL.md | Opened as native source; editor bytes match disk SHA-256 |
| IDENTITY.md | Opened as native source; editor bytes match disk SHA-256 |
| AGENTS.md | Refused: symbolic link in managed path |
| USER.md | Refused: symbolic link in managed path |
| TOOLS.md | Refused: symbolic link in managed path |
| HEARTBEAT.md | Refused: symbolic link in managed path |

All six entries were visible in the real management webview. The four links point
at the installation's other workspace; they were not replaced or followed by the
editor. Continuous native keyboard input and Undo passed on SOUL.md, with autosave
off, the original content hash restored and no dirty buffer or disk write.

Lifecycle is unavailable with the observed reason **"Native unit uses an
unqualified environment file."** The real gateway uses `gateway.systemd.env`,
which this candidate's systemd verifier does not qualify. No ownership descriptor
was created and no control was weakened to enable Start/Stop/Restart. API-only
inspection also does not establish a durable managed HUD owner.

## Source correction found during inspection

The HUD previously assigned the state directory to native `OPENCLAW_HOME`.
OpenClaw uses that variable to expand `~`, so the actual tilde-based workspace
resolved with a duplicated state-directory component and discovery failed.

The review checkout now preserves the native user-home environment while pinning
`OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` separately. The managed launcher
maps its `--home` installation argument to the state directory, and the local
helper's fallback uses the recorded launch user home. Regression tests cover
authenticated HUD discovery, subsequent helper resolution and managed launcher
start/stop with tilde-based workspaces. The exact VSIX needs no bundle change for
this correction; its backing source HUD/helper must include the fix.

## Validation and limits

| Check | Result |
| --- | --- |
| Extension TypeScript check and build | Passed |
| Focused discovery/files/launcher/view suite, including installed native CLI | 12 passed, 0 failed/skipped |
| Final complete extension suite | 85 total: 78 passed, 5 failed, 2 skipped |
| HUD regression suite | 372 passed on rerun; initial run hit the previously observed avatar timing assertion |
| Candidate active module path/hash, remote host and storage isolation | Verified |
| Real native reads, continuous keyboard input and Undo | Verified for regular files; explicit link refusals above |
| Original files and service process identities | 31 file hashes and five service PIDs/start times unchanged |

The five extension failures are full lifecycle/offline recovery (both runtimes),
changed-scope rejection, orphan recovery, and combined Save & Restart. All report
the host's unqualified native environment file; they are not recorded as passes.
The two skips are the macOS-only launchd test and optional cached RAG execution.
The initial extension run also lacked a built stdio test bundle; that failure
cleared after the normal source build. Fixture processes remained isolated from
the real runtime. Native real save/upload/restart was intentionally not exercised.

Private evidence is under `~/.cache/netclaw152-wsl-20261015/`, including
`preview.json`, `editor-report.json`, `keyboard.json`, `baseline.json`,
`preservation.json`, test logs, the preserved-download manifest and a screenshot
with source content masked. Full installation UUIDs, workspace paths, PIDs and
file hashes remain there. The preview API is deliberately left running for the
owner; stop only its recorded PID after inspecting its identity. Close the
disposable editor windows normally. Do not terminate the original HUD/gateway.
