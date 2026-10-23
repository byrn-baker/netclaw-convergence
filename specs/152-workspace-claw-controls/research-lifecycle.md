# Spec 152 lifecycle research

Research date: 2026-10-15. Read-only inspection of repository helpers, installed OpenClaw CLI help/status and installed implementation. No running service was started, stopped, restarted, adopted or reconfigured. Hermes CLI is not currently on this extension host's PATH; Hermes native-service observations below come from the pinned upstream source and are not live qualification.

## Recommended implementation boundary

Use a host-local management layer in the VS Code extension host, with private state beneath the already verified runtime home. Its saved binding and operation journal must remain usable without HUD HTTP. Do not make the HUD responsible for stopping and recovering itself. The existing connection profile identifies only URL, host context, runtime kind and installation ID: add a distinct durable management binding containing canonical runtime home, config, repository root and complete observed service set. Identity must first match a running connection and the private `netclaw-hud/installation.json`, then be revalidated from disk for offline actions.

Implement only controllers with provable ownership. An arbitrary old foreground HUD, arbitrary gateway process, opaque wrapper or unknown supervisor makes **full lifecycle unsupported** with an explicit reason; do not silently drop it from the service set. File read/edit can remain independently available. Once the owner launches a current ownership-recording HUD, it can become eligible without adoption by process name or port.

Stop sequence: stop ingress/owned federation, stop owned HUD (including its Hermes engine companion), stop a separately configured native runtime gateway. Start sequence: native gateway where configured, owned HUD/engine, then configured federation. Report every reviewed service, including optional service absence. Stop/restart requires explicit interruption acknowledgment; unavailable activity evidence remains unknown. Restart is an observed stop followed by start, not a single opaque command. Any unknown stop outcome blocks subsequent start until observation resolves it.

## Existing helpers and gaps

| Component | Reusable source | Present behavior / necessary addition |
| --- | --- | --- |
| Runtime identity | `scripts/runtime-selection.mjs` / `.py` | Explicit runtime selection, canonical home, private installation UUID. Pass `initialize:false` for all discovery. Do not use its generic `workspacePath` as file-location authority. |
| Environment isolation | `extensions/netclaw-vscode/src/client/setup.ts: setupEnvironment` | Removes other-runtime/installation variables and binds home/config. Extend with reviewed native service identity when needed; custom OpenClaw home alone does not select a service label. |
| HUD | `scripts/hud-launch.mjs` | Foreground launcher; process-local children only. Starts API, Vite and, for Hermes, protected companion. Child process groups are terminated on launcher SIGTERM. **No persistent ownership record or stop command currently exists.** |
| Federation | `scripts/federation-control.py` | `status`, `start`, `stop`, `restart`, `run`; private PID/start-time record, lock, installation check, authenticated identity-shaped status. Direct stop is only appropriate when not supervised. |
| Federation supervisor | `scripts/in2n-services.py`, `scripts/systemd/netclaw-mesh.service` | `Restart=always`; exact selected mesh name has a home-derived suffix except legacy default OpenClaw. Never call generator/enable for this feature: they can also operate member claws and DefenseClaw. |
| Hermes federation engine | `mcp-servers/protocol-mcp/bgp/federation/hermes_runtime.py` | Companion is owned by federation daemon and stops through daemon cleanup. Do not independently kill/restart its child. `bgp-daemon-v2.py` calls `stop_runtime()` on SIGTERM. |
| Hermes HUD engine | `mcp-servers/hermes-hud-mcp/hermes_api.py` | Protected companion is the engine actually used by HUD. SIGTERM runs HTTP/adapter cleanup. Detailed authenticated health includes installation ID, namespace and qualification. Native messaging gateway is separate and may also be configured. |
| Current extension services UI | `src/views/services.ts`, `src/client/commands.ts` | Stages commands without executing. It is insufficient for full direct control or recovery. |
| Audit patterns | `src/client/setup.ts` | Private metadata-only prepared-input hashes, journals and unknown outcomes are useful patterns; keep a separate lifecycle lock/journal. |

## Ownership-recording HUD controller

Extend `hud-launch.mjs` with explicit background start/status/stop through the same selected runtime, retaining foreground use. Record launcher PID, process birth marker, UID, executable, canonical script/root, installation ID, nonce, resolved ports, child ownership and runtime kind in a 0600 record inside a 0700 selected-home directory. Record complete configured scope before readiness. Use an exclusive lifetime lock and private atomic records; require matching owner/identity and refuse symlinks or foreign records. A PID alone is insufficient.

For stop, validate launcher identity at signal time, signal only that launcher, and let it stop its owned children. Await each owned child's actual exit; check all expected listeners disappeared and no supervisor relaunched the launcher. Preserve stale record as evidence instead of fabricating a fresh ownership claim. Background start requires existing dependencies/configuration/identity and no foreign listener; it must not create credentials or install anything. The current launch path creates missing companion auth, so the managed Start preflight must require existing valid auth/config rather than silently initializing it.

An owned launcher needs correct cleanup on partial startup failure and a lifecycle report on exit. Extension reload must not terminate a valid detached launcher. Extension operation evidence records requested/stopping/stopped/starting/ready/failed/unknown with PID birth markers and per-service timestamps, no environment or config text. A process that is alive but cannot answer qualified readiness is running-unready, never ready.

## Native gateway service binding

Installed OpenClaw is `2026.7.1-2` (`0790d9f`). `gateway status --json --no-probe` reports `service.command.programArguments`, `workingDirectory`, `sourcePath`, projected `environment`, `service.runtime.{status,state,pid}`, `config.cli.path`, `config.daemon.path`, and gateway port. Read-only observation confirmed these shapes. Do not commit raw status: command metadata can reference private paths and environment sources. `--no-probe` does not prove readiness.

OpenClaw service naming is independent of the selected home. Default macOS label is `ai.openclaw.gateway`; `OPENCLAW_PROFILE` changes it to `ai.openclaw.<profile>`, and `OPENCLAW_LAUNCHD_LABEL` can override it. Linux defaults to `openclaw-gateway.service`, profile form `openclaw-gateway-<profile>.service`, with `OPENCLAW_SYSTEMD_UNIT` override. Never guess a default label merely because the runtime kind is OpenClaw.

The installed native OpenClaw stop/restart implementation invokes `cleanStaleGatewayProcessesSync`, selecting gateway-like processes by listening port and then SIGTERM/SIGKILL. That is broader than Spec152 installation ownership. Prefer the exact bound service-manager operation after validation, not the broad native command. Do not use `--force`, install, doctor/fix, uninstall, reset or configuration mutations.

Binding predicates for an eligible native service:

1. Canonical private installation identity and selected config remain unchanged, owned by current UID; runtime matches the connection binding.
2. Exactly one manager definition resolves to this installation. Service source is a regular file, not a symlink or hardlink, at an expected user-service location, owned by the user and not writable by other users. Preserve definition and drop-in hashes in review. Do not select a service by description, display label, port or basename alone.
3. Manager-loaded source, executable/arguments, working directory and relevant environment agree with the on-disk definition. Effective OpenClaw state/config or Hermes home resolve to selected canonical paths. Read private environment values internally only; project just paths/identity and hashes. Hash every contributing wrapper/environment file without recording its raw contents.
4. Accept a direct recognized engine invocation or a specifically validated known wrapper grammar. An arbitrary shell script can set dynamic variables, read unrelated files or invoke another installation; its hash proves stability, **not ownership**. Refuse it unless its semantics can be fully bounded. No evaluation, sourcing or executing wrappers for inspection.
5. A known direct invocation with no explicit home/config can be bound only when its effective account home/default profile is established, selected runtime home equals that exact default, and independent native daemon-config status agrees. Working-directory equality alone is insufficient. A wrapper lacking explicit scope remains unsupported unless its entire validated grammar establishes the same facts; CLI daemon path alone must not override ambiguous wrapper behavior.
6. Running process is the manager's MainPID/PID, with matching UID/start marker and expected executable/descendants. The manager job path/domain must agree. Port ownership is an additional collision check, not identity authority.
7. Revalidate definition, config identity, effective environment inputs and service scope immediately before mutation. Any change invalidates review. No target/profile reinterpretation on offline recovery.

Suggested sanitized service shape (placeholder paths/IDs only):

```json
{
  "id": "gateway",
  "kind": "openclaw",
  "controller": "launchd",
  "scope": "user",
  "installationId": "<bound-uuid>",
  "definition": "<account-home>/Library/LaunchAgents/<verified-label>.plist",
  "definitionSha256": "<sha256>",
  "domain": "gui/<uid>",
  "label": "<verified-label>",
  "home": "<canonical-runtime-home>",
  "config": "<canonical-config>",
  "state": "running",
  "pid": 12345,
  "birth": "<observed-process-birth>",
  "observedAt": "<ISO-8601>"
}
```

## Exact manager operations

**macOS:** Read existing `~/Library/LaunchAgents/<verified-label>.plist` through a structural plist parser, not regex. Inspect `Label`, `ProgramArguments`, `WorkingDirectory`, relevant `EnvironmentVariables` and any known wrapper/environment source. Read `launchctl print <domain>/<label>` to establish the actual loaded service; use the observed `gui/<uid>` or `user/<uid>` domain and retain it after Stop. Execute argv `['bootout', '<domain>/<label>']`; observe no manager PID and owned process exit. For Start use `['bootstrap', '<domain>', '<same-reviewed-plist>']` only when unloaded, or a non-killing `kickstart` of a known loaded/stopped job if appropriate. Check disabled state and return actionable refusal when start would require enabling. Do not use `kickstart -k` as the restart implementation, repair plist contents or select a different domain after failure. A Stop means unloaded until explicit start or a later login service load; persistent disable across login is a different policy choice and must be explicit.

**Linux/WSL:** Read `systemctl --user show <exact-unit> --property=Id,Names,LoadState,ActiveState,SubState,MainPID,FragmentPath,DropInPaths,ExecStart,Environment,EnvironmentFiles,WorkingDirectory,ControlGroup,Restart,UnitFileState --no-pager`; keep secret-bearing fields private. Validate all loaded sources/drop-ins and canonical target environment. Use argv `['--user','stop',unit]` / `['--user','start',unit]`. Stop through systemd suppresses its Restart=always policy for that action; direct PID termination does not. Observe inactive state and no owned process/control-group leftovers, then verify application readiness after Start. Preserve enablement; do not `enable`, `disable`, `daemon-reload`, generate units or use sudo. Missing user manager, opaque source, changed drop-ins, system-scoped unit or other UID is unsupported. Remote SSH and WSL use their extension host's local manager and filesystem, never the desktop host's paths.

**Federation supervisor selection:** Determine the exact expected mesh unit using existing `_mesh_name()` convention, but establish ownership by effective `NETCLAW_RUNTIME`, runtime home/config, `NETCLAW_INSTALLATION_ID`, `N2N_BASE_DIR`, exact `federation-control.py run` executable and source hashes. Compare manager MainPID against the selected daemon ownership record. If installed/loaded unit owns the daemon, use manager controls even if service is currently stopped. If no manager owns it and an authenticated valid standalone record exists, use `federation-control.py`. Ambiguous manager/process ownership refuses full lifecycle. Service discovery must not include `netclaw-member-*` or `defenseclaw-sidecar.service`: those belong to other claws/shared protection. Do not let a systemd Stop be followed by the standalone helper Start, which would change ownership and later permit duplicate launches.

## Hermes native gateway versus protected engines

The HUD engine is the owned protected companion, with a second companion owned by federation where configured. A native messaging gateway is a separate optional service; discover it and include it if it belongs to the selected installation. If configured but unmanageable, refuse full lifecycle rather than describe a companion-only stop as complete.

Pinned Hermes upstream native service names use `hermes-gateway` plus a profile or home-hash suffix; older bare units can own custom homes, so inspect actual `HERMES_HOME` rather than relying on the naming algorithm. Generated systemd services explicitly pin `HERMES_HOME`, use Restart=always, and have stop hooks. Native lifecycle can adopt system scope or refresh definitions, so this feature should use validated user-manager primitives. These are source observations, not executable local acceptance. [Pinned native gateway source](https://raw.githubusercontent.com/NousResearch/hermes-agent/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/gateway.py).

The pinned launchd adapter uses `ai.hermes.gateway` with a suffix, probes GUI and user domains, and can fall back to detached operation. Its generated launcher may use `osascript` and a shell wrapper. Do not execute that native fallback implicitly; require a known, validated wrapper and preserve the observed manager. A recognized service with an opaque launcher remains unsupported until specifically qualified. [Pinned launchd adapter](https://raw.githubusercontent.com/NousResearch/hermes-agent/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/gateway_launchd.py).

## Acceptance priorities

- Isolated owned HUD OpenClaw and Hermes: start, readiness, stop, sustained stopped state, offline extension reload, same-installation start, restart and partial child failure; neighboring ports/installation untouched.
- Managed native service fixtures plus an actually isolated launchd gateway on macOS; Linux/WSL user-unit acceptance remains separate until executed. No owner service mutations are needed.
- Supervisor Restart=always race, stale PID/birth, changed unit/wrapper/env/drop-in, foreign listener, symlink/hardlink, missing authorization, wrong host/runtime and lost response must fail safely.
- Native Hermes messaging gateway optional absence versus configured unsupported must have distinct UI results. Neither private companion readiness nor native gateway process presence proves provider/tool execution or prompt revision consumption.
- Durable phase journal and exclusive per-installation mutation lock survive HUD stop and editor reload. Recovery observes current state and never automatically retries a timed-out action or replays agent work.
