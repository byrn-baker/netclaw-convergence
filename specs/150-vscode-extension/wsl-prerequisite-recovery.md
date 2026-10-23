# WSL prerequisite recovery and acceptance continuation

Prepared on Mac, 2026-10-11. **Plan only; no owner repair performed.**
Return reviewed: `1aaaafac8a47a918e37849b3266d4e1796326a3a`, following evidence
commit `5983cc37e192ba4954ff50fa65d502a5fa385d8f`.

## Findings and limits

- The returned VSIX is byte-identical to the Mac candidate:
  `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
  WSL proved installation/activation and 16 passing source tests, not live acceptance.
- Owner source `aa27953` already declares and locks
  `@modelcontextprotocol/client@2.3.1`. Its HUD package, lockfile, launch script,
  runtime selection script and Node policy helper match baseline `f943637`.
  The static import in `src/hud-server/runtime/hermes.js` explains why a missing
  installed package prevents API startup even when OpenClaw is selected.
- Node 25.1.0 fails the existing HUD policy. WSL already used isolated Node
  24.19.0 successfully for checks. Selecting that existing executable for the
  HUD is the proposed remedy; no global Node or OpenClaw upgrade is proposed.
- These observations support a dependency/runtime repair, but do not prove it
  will resolve every live prerequisite. The current unit, wrapper and runtime
  home must be observed on WSL; their exact contents were not transferred.
- The editor log proves an update mutex refused the isolated launch. An
  [upstream VS Code report](https://github.com/microsoft/vscode/issues/324944)
  describes the same failure class. It does not establish this host's updater
  state or justify bypassing its lock.

The prior WSL owner instruction was “Use this installation; record live checks as
blocked.” This plan does **not** itself authorize changing that installation.
Obtain explicit approval for the bounded repair below before its apply phase.
The extension remains a client of existing NetClaw; no backend feature/code work
is required by the evidence presently available.

## Bounded repair for approval

Allowed after approval: stage the owner HUD's exact locked dependencies, retain
the old dependency tree for rollback, select the already-installed supported
Node for this HUD service only, and stop/start this HUD service during a safe
maintenance window. Preserve the existing runtime/home/configuration/ports and
OpenClaw CLI identity. Native HUD startup may create a missing installation
identity through its existing implementation; retain it and record that fact.
Do not manufacture, overwrite or rotate an existing identity.

Excluded: source edits/upgrades, global package installation, gateway/mesh/member
restart, selection-descriptor changes, provider/credential edits, peering, approval
changes and WSL shutdown. A new failure outside this scope needs a concrete
finding, not an automatic wider repair. No operator-management backend is added.

### 1. Observe and prepare on WSL

1. Read startup files and start **and select** a GAIT session branch. Preserve the
   current validation checkout. Record fresh Git status/source, boot time,
   relevant service identities and the eight prior file observations. Keep raw
   paths, unit environment, logs, credentials and hashes in owner-private storage.
2. Inspect `netclaw-hud.service`, its drop-ins and actual wrapper locally. Resolve
   working directory, selected home/harness, port bindings and Node/npm/OpenClaw
   executables. Identify dependencies/stop propagation before proposing a stop;
   if stopping this unit also stops another service, stop preparation and report.
   Never paste unredacted unit/environment output into Git or chat.
3. Verify the existing Node 24.19 executable with `--version` and the owner's
   `scripts/hud-node-version.mjs`. Record an absolute executable path. Resolve npm
   and OpenClaw before changing any PATH. A PATH edit must not silently select a
   different OpenClaw installation or wrapper.
4. Verify the owner's package and lockfile still match the reviewed source. If
   changed, inspect the difference rather than overwriting it. Check available
   space for both old and replacement dependency trees; reject shared/symlinked
   dependency directories until their ownership/impact is understood.
5. In a new private staging directory on the same filesystem, copy only those two
   package files and install using the supported Node and its resolved npm CLI:

   ```sh
   "$HUD_NODE" "$HUD_NPM_CLI" --prefix "$HUD_DEP_STAGE" ci --ignore-scripts --no-audit --no-fund
   ```

   These variables must be assigned from observed absolute paths, not guessed.
   Include dev dependencies because the existing service runs Vite/concurrently;
   do not inherit a production-only omit setting. Check the staged lockfile hash
   remains identical. Verify imports of `@modelcontextprotocol/client` and
   `@modelcontextprotocol/client/stdio` from inside the stage with that Node.
   Verify required Vite/concurrently entry files exist. No HUD process is started.
   If install scripts/native rebuilds prove necessary, review those exact scripts
   separately rather than switching to an unrestricted install.

   [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) installs from the
   lockfile and replaces an existing dependency directory. Staging avoids doing
   that against the active service. `--ignore-scripts` suppresses lifecycle scripts.
6. Prepare a minimal HUD-only unit drop-in or wrapper change against the **actual**
   service definition: select the verified Node and preserve all other arguments,
   environment/configuration inputs and runtime/home. Inspect child-process Node
   selection as well as the parent executable. Do not invent a generic `ExecStart`
   or switch the owner to a different launcher. Save original bytes/modes and an
   exact rollback procedure before applying. Show a redacted diff and affected
   paths. Prior scope approval suffices if this remains exactly within it.

### 2. Apply only after approval and a safe HUD window

1. Confirm no active HUD request would be interrupted and take a fresh baseline.
   Stop only the observed HUD unit; verify its owned API/UI children stopped and
   its ports are free. Do not kill an unrelated listener to make room.
2. Rename the original HUD `node_modules` to a unique adjacent backup. Rename the
   staged dependency tree into its place. Preserve both trees; never delete the
   original. Apply only the prepared HUD service adjustment and reload user-systemd
   unit definitions if needed. Do not change system/user-global PATH or Node links.
3. Start only that HUD unit. Confirm API and UI child executables actually use the
   supported Node. Probe the observed loopback `/api/runtime` with a bounded GET;
   require the intended harness/home identity and explicit readiness. Verify an
   existing identity was preserved, or record the newly created native identity.
   A running wrapper or listening UI alone is insufficient.
4. Verify configuration/testbed/credential/selection hashes unchanged, source and
   lockfiles unchanged, unrelated services retained identity, and intended HUD
   changes are fully enumerated. Do not call the restored API healthy merely
   because the missing-module error disappeared. Inspect real readiness next.
5. On failure, stop only the new HUD processes; preserve the failed tree for
   diagnosis; restore the original dependency directory and exact service bytes;
   reload unit definitions if changed and restore the prior HUD service state.
   This restores the original **degraded** baseline, not a healthy API. Preserve
   any identity created by native startup and report it rather than deleting it.
   Do not escalate into gateway/provider/credential repair automatically.

### 3. Clear the editor prerequisite normally

Save Windows VS Code work and let its normal pending update finish. The owner
should close/reopen the necessary windows when ready; automation must not terminate
them. Do not remove update locks, kill the updater or disable its mutex check.
Retry one isolated launch and record actual desktop/server versions. If it remains
blocked, retain the exact new failure; repeated install attempts are not progress.
Neither a machine reboot nor WSL shutdown is required by this plan.

## Resume the existing acceptance matrix

Once API readiness and isolated editor launch both pass, continue
[windows-wsl-handoff.md](windows-wsl-handoff.md), keeping the original returned
evidence intact. Put new evidence in `evidence/wsl-followup.md` with a concise
machine-readable report. Use the exact incoming VSIX, not the rebuilt `dist` tree.

Complete actual connection/identity/host location, populated panels, harmless real
provider Chat/history, Canvas/Avatar/context, RAG upload/index/citation, cancelled
settings reviews, lifecycle staging and target/trust/reconnect checks. Record
unavailable optional harnesses/features accurately. Real settings replacements
belong in an isolated fixture, not the owner's credentials.

Use signed-in **interactive** Copilot, Claude Code and Codex: status, inspection,
inert proposal, human-consented harmless delegation/result, then disabled cached
call refusal. Keep their normal approval controls. Ask the owner to perform UI
consent if automation cannot operate the prompt; do not replace this with CLI
presence, a noninteractive denied call or synthetic responses.

Qualify the exact installed VSIX's upgrade, disable/re-enable and uninstall in a
separate Windows editor profile connected to WSL. Verify the remote extension
directory and storage isolation before installing a synthetic older version or
uninstalling anything: a Windows profile alone does not prove remote isolation.
Use a verified separate remote server data directory, or a disposable WSL host
only if available and authorized. Preserve the owner-installed candidate.
The existing `scripts/lifecycle.mjs` is a Mac/Linux desktop harness; do not label
its Linux-only result as Windows-desktop/WSL lifecycle acceptance.

No source/VSIX change is justified by this return. Fix only a reproduced extension
defect. If any package input changes, preserve this candidate, build from a clean
commit, record a new digest and qualify that exact replacement on required hosts.

Commit/push only sanitized evidence and reviewed extension changes; update the Mac
return prompt with the exact tip. T022 stays open until its required checks are
proved. T023 follows Mac review and exact-artifact publication/install verification.
No Marketplace credentials are transferred to WSL, and WSL does not publish.
