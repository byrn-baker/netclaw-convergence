# WSL handoff — Spec152 real-workspace inspection

Branch: `152-workspace-claw-controls` on `automateyournetwork/netclaw`.
Candidate: **NetClaw 1.1.0**, not published to Marketplace.
The VSIX, source commit, size and digest are in [handoff/package.json](handoff/package.json);
verify [handoff/SHA256SUMS](handoff/SHA256SUMS) before using it.

The owner authorized packaging and pushing this branch, then opening an isolated
patched VS Code against the real NetClaw in WSL to inspect its workspace files.
The Mac preview passed against isolated runtime/process fixtures. Real WSL service
control is still to be qualified. No merge, Marketplace release, replacement of the
normal editor extension, real file overwrite or live restart is part of this inspection.

## Paste this prompt into the agent on WSL

```text
Continue Spec152 from origin/152-workspace-claw-controls in automateyournetwork/netclaw.
Read specs/152-workspace-claw-controls/WSL-HANDOFF.md and verification.md first.
The owner explicitly authorized package/push and now wants a real, visible, ephemeral
Windows VS Code + WSL extension host running this patch, connected to the REAL NetClaw,
with the six actual workspace Markdown files available for inspection.

Drive this to a visible working preview. Follow repository startup/GAIT instructions.
Fetch the branch into a separate Linux-filesystem worktree; preserve the running checkout,
all real configuration/credentials, the installed normal VS Code extension and live services.
Verify the committed handoff VSIX digest and launch its extracted extension payload in a
fresh Windows VS Code user-data/extensions directory, using a remote WSL Extension
Development Host. Do not silently substitute the Marketplace build or the synthetic preview.
Verify the loaded NetClaw 1.1.0 extension path AND dist/extension.cjs hash, and confirm that
its extension host runs in the correct WSL distribution. Read the actual guest OS version;
the distro registration name may be misleading. Use normal Workspace Trust prompts.

Discover the actual selected runtime, installation UUID, home, native agent workspace,
HUD address and source checkout from the host's existing configuration and read-only
observations. Both OpenClaw and Hermes are supported; use the real selected installation.
Never guess ~/.openclaw/workspace or treat this repository's Markdown files as the
runtime workspace. Never print credentials or raw persona content in logs/reports.

The extension needs the patched session-authenticated GET /api/hud/management route.
If the existing HUD lacks it, launch only this worktree's source HUD API on an unused
loopback port with the real installation's verified runtime/home/config/environment.
Use the API-only procedure below. Keep the existing gateway, HUD, companion and federation
running. Do not run the installer, switch the global selected runtime, write managed-service
descriptors or use hud-launch managed/start to establish this parallel inspection API.
Reuse an existing Hermes companion credential/port without rewriting either.

In the isolated editor, connect to that real installation's API, review its native local
management binding, and open Workspace & Claw in the upper Connections panel. Open each
of SOUL.md, AGENTS.md, IDENTITY.md, USER.md, TOOLS.md and HEARTBEAT.md in the native editor.
Confirm their paths and hashes against the actual host files; accurately display any
missing or refused file. Leave SOUL.md or USER.md visible and the panel available.
Do not auto-save synthetic content, upload, overwrite, or press Stop/Start/Restart against
live services during this inspection. Those are available only through their native exact
content/service reviews if I subsequently choose them. Explain a disabled lifecycle control
from its actual ownership reason; do not weaken checks or adopt processes to make it green.

Record the candidate SHA-256, active extension path/host, Windows VS Code version, actual
WSL OS, HUD checkout/port/PID, runtime UUID and actual workspace path locally. Verify the
six file hashes and pre-existing service PIDs/states are unchanged. Keep private details
local. Leave the preview open for me and report how to find it and stop only its API later.
No merge, production deployment, package publication or external messages.
```

## Fetch without changing the running checkout

Run from the existing NetClaw repository in WSL, choosing another new review directory
if the example already exists:

```sh
git fetch origin 152-workspace-claw-controls
git worktree add --detach "$HOME/netclaw-spec152-review" origin/152-workspace-claw-controls
cd "$HOME/netclaw-spec152-review"
sha256sum -c specs/152-workspace-claw-controls/handoff/SHA256SUMS
```

Use the Linux filesystem under the WSL user's home, not `/mnt/c`, for the source,
extracted extension and runtime data. The management helper requires trustworthy
ownership/modes and rejects unsafe paths. Do not relax those checks or recursively
change permissions on the live installation.

## Prepare the packaged extension for an ephemeral remote development host

Extract the verified VSIX into a new private directory in WSL. This avoids installing
NetClaw into the shared remote extension directory. Its bundles are already built;
no extension dependency installation or rebuild is needed for this preview.

```sh
REVIEW_PAYLOAD=$(mktemp -d "$HOME/netclaw152-payload.XXXXXX")
chmod 700 "$REVIEW_PAYLOAD"
python3 -m zipfile -e specs/152-workspace-claw-controls/handoff/netclaw-1.1.0.vsix "$REVIEW_PAYLOAD"
mkdir -p "$REVIEW_PAYLOAD/extension/.vscode"
cat > "$REVIEW_PAYLOAD/extension/.vscode/launch.json" <<'JSON'
{
  "version": "0.2.0",
  "configurations": [{
    "name": "Spec152 — packaged extension in WSL",
    "type": "extensionHost",
    "request": "launch",
    "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
    "outFiles": ["${workspaceFolder}/dist/**/*.cjs"]
  }]
}
JSON
printf '%s\n' "$REVIEW_PAYLOAD/extension"
```

From **Windows PowerShell**, create a separate editor profile. Discover the registered
distro using `wsl --list --quiet` and replace the two explicit placeholders below with
that registration and the printed Linux extension path:

```powershell
$ReviewProfile = Join-Path $env:TEMP ("netclaw152-" + [guid]::NewGuid())
$ReviewUser = Join-Path $ReviewProfile "user"
$ReviewExtensions = Join-Path $ReviewProfile "extensions"
New-Item -ItemType Directory -Path (Join-Path $ReviewUser "User") -Force | Out-Null
@'
{
  "telemetry.telemetryLevel": "off",
  "extensions.autoUpdate": false,
  "update.mode": "none",
  "files.autoSave": "off",
  "files.hotExit": "off",
  "chat.disableAIFeatures": true,
  "window.title": "NetClaw Spec152 — REAL WSL workspace inspection",
  "workbench.startupEditor": "none"
}
'@ | Set-Content -Encoding utf8 (Join-Path $ReviewUser "User\settings.json")
code --user-data-dir $ReviewUser --extensions-dir $ReviewExtensions --install-extension ms-vscode-remote.remote-wsl
code --user-data-dir $ReviewUser --extensions-dir $ReviewExtensions --new-window --remote "wsl+<REGISTERED-DISTRO>" "<PRINTED-LINUX-EXTENSION-PATH>"
```

In that WSL window, trust the reviewed payload and press **F5** using the supplied
launch configuration. This opens the Windows-rendered Extension Development Host
with the extension executing in WSL. Keep Settings Sync off. Do not install the VSIX
into the ordinary Windows/WSL profile. Verify **Developer: Show Running Extensions**
and activation logs/debugger for the exact extracted path; a displayed version alone
is insufficient. The remote server installation may be shared with existing WSL
windows; this workflow does not uninstall/update their NetClaw extension or restart
the shared server. This follows VS Code's [WSL debugging workflow](https://code.visualstudio.com/api/advanced-topics/remote-extensions#debugging-using-wsl)
and [isolated CLI directories](https://code.visualstudio.com/docs/configure/command-line#isolating-vs-code-instances).

## Connect to the actual runtime using a separate preview API when needed

The VSIX contains the extension. The **host helper and new HUD route come from this
branch's source checkout**; updating only the extension cannot add that route to an
older running HUD. The normal `preview:workspace` script uses synthetic installations
and is unsuitable for the requested real-file inspection.

1. Establish the real selected runtime/home/config and installation UUID from existing
   configuration and `/api/runtime`. For OpenClaw, run the installed native
   `openclaw agents list --json` with that installation's actual launch environment
   and select the intended agent. For Hermes, persona files are directly in its home.
   Record file hashes and live service ownership/PIDs locally before launching anything.
2. If the current HUD already serves this branch's authenticated discovery route with
   the correct source/identity, use it. Otherwise install **only this worktree's** HUD
   dependencies using supported Node (`>=24.19 <25` or `>=26.1`):
   `npm --prefix ui/netclaw-visual ci`. Do not run any NetClaw installer or upgrade the
   native runtime. Check that the selected home already has a valid private
   `netclaw-hud/installation.json`; inspection must not invent a new identity.
3. Pick two distinct unused unprivileged loopback ports for `HUD_PORT` and
   `HUD_UI_PORT`. The second is used for origin validation; no Vite/UI server is needed
   for this extension preview. Start **`node server.js` from `ui/netclaw-visual`** in a
   dedicated terminal with the actual selected environment and these port overrides.
   OpenClaw needs explicit `NETCLAW_RUNTIME=openclaw`, `OPENCLAW_HOME`,
   `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, and the correct optional
   `OPENCLAW_PROFILE`/`HUD_AGENT_ID`. Hermes needs `NETCLAW_RUNTIME=hermes` and
   `HERMES_HOME`, with conflicting OpenClaw variables absent. Preserve the real user's
   HOME and the installed CLI's PATH. Use the repository's literal dotenv parser when
   selected-home environment values are needed; never shell-source `.env` or print it.
   Reuse Hermes's installed private bridge/companion without rewriting its auth/port.
   The server binds `127.0.0.1`; do not expose it or forward it publicly.
4. Record the exact preview API PID and confirm `/api/runtime` reports the pre-existing
   UUID and runtime. Connecting creates ordinary private HUD session metadata and
   management inspection may create its private evidence directory; it must not
   change the six files, engine configuration or owned service descriptors. No
   provider chat or device request is needed for this inspection.
5. In the Development Host use **NetClaw: Connect** with
   `http://127.0.0.1:<PREVIEW_API_PORT>`. Open **Workspace & Claw** at the top of
   Connections. Review the native binding's home, workspace, source path and identity.
   No write or lifecycle action occurs on bind. Open the six source documents.

The API-only preview is intentionally not registered as a full-claw managed HUD.
Legacy/unattributed services may leave lifecycle controls unavailable. Reading and
reviewed file editing are independent of full lifecycle eligibility. Establishing
managed ownership on a real installation is a separate deployment/change; do not
change service descriptors or stop the existing HUD merely to enable buttons here.
If native discovery fails, investigate the actual CLI/environment/path permissions
and report the cause rather than substituting repository files.

## Review, evidence and cleanup

Leave the editor and preview API running for the owner. Keep persona text, screenshots
of private files, tokens and real service definitions out of git and chat. Report
paths/status/hashes only. Stop only the recorded preview API with its own terminal's
Ctrl+C after inspection; close the ephemeral editor normally. Do not use `pkill`,
port-wide termination, `code --uninstall-extension`, or a global WSL-server shutdown.
Retain private editor data if there are unsaved drafts; Hot Exit is disabled for this
preview. The original runtime services and normal editor remain available.

For later lifecycle qualification, use isolated Linux fixtures first, then the real
installation only with the owner's exact native service review. Existing Mac evidence
is in [verification.md](verification.md); it is not a claim of live WSL acceptance.
