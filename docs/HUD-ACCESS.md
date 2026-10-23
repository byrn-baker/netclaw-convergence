# Local and remote HUD access

The HUD can read credentials, edit local configuration, and invoke your agent. It is a trusted local operator interface. Starting with spec 124, by default both the API and frontend bind to `127.0.0.1`. HTTP and WebSocket requests reject untrusted browser origins and hostnames. Native Windows is not a full NetClaw host; use WSL2. macOS and Linux are supported host paths.

After updating the checkout, from `ui/netclaw-visual`, run `npm ci` (required to adopt the patched lockfile), then `npm run dev`, then open <http://127.0.0.1:3000>. Adam Mason's context chat remains at `/canvas.html`. For a built frontend, run `npm run build`, `npm run server`, and `npm run preview` in the appropriate terminals.

`HUD_PORT` configures the API port (default 3001), and `HUD_UI_PORT` configures the frontend port (default 3000). Export the same values in the API and frontend processes. Ports must differ; the frontend fails rather than silently moving to an untrusted port.

## Bind to a trusted Ethernet interface

From `ui/netclaw-visual`, select the host's concrete interface IP:

```bash
HUD_HOST=192.0.2.10 npm run dev
```

Open `http://192.0.2.10:3000` from another computer, substituting the actual host IP.
The UI forwards API and WebSocket traffic; port 3001 stays bound to loopback.
`HUD_HOST` is an environment variable, not a Vite command-line argument.
For separate API and preview processes, export the same `HUD_HOST` in both terminals.
The default is `127.0.0.1`; wildcard addresses and hostnames are rejected.
Restart without `HUD_HOST` to return to localhost access.

This explicitly trusts clients that can reach the selected interface. It adds no
login or TLS. Use it on a trusted network with appropriate host/network access
controls. Host and Origin checks prevent arbitrary browser origins; they do not
authenticate users. The native OpenClaw link still points to the client's loopback
address and requires its own tunnel. Browser storage is separate for each origin.

## Authenticated remote access

For authenticated remote access, use SSH. Run the provided migration helper **on your client machine**, using an SSH account on the NetClaw host:

```bash
# Preview: no connection and no state changes
python3 scripts/migrate-hud-access.py --ssh-target operator@netclaw-host

# Connect: SSH authenticates normally and holds the tunnel open
python3 scripts/migrate-hud-access.py --ssh-target operator@netclaw-host --connect
```

Then open <http://127.0.0.1:3000> locally. Both frontend and API ports are forwarded on loopback only. The helper disables agent forwarding, retains SSH host-key verification, and fails when a forwarding port is already occupied. It does not install keys, alter SSH configuration, or change NetClaw data. Use an existing SSH configuration alias for unusual host addressing or custom SSH ports.

For custom HUD ports, pass matching `--ui-port` and `--api-port` values. If a local port is occupied, stop the conflicting process or select matching custom ports on the host and helper; do not expose the API on a network interface.

## Recovery and limits

Ctrl-C closes the tunnel. No data/configuration migration occurs, so no backup restoration is needed. A failed SSH connection leaves the original installation untouched. The server must already be running on the remote host. Access is for a trusted operator on the local machine or authenticated SSH account; this is not a multi-user authentication system. Do not publish the Vite proxy or API through an unauthenticated reverse proxy. A public deployment needs a separately reviewed authentication design.

## Agent selection

The HUD uses the configured agent when only one exists, or the marked default
in legacy agents.list configuration. With multiple agents and no unambiguous
selection, export HUD_AGENT_ID to an existing agent ID before starting the API.
The selected agent is used for chat, private session keys and transcript paths.

## Long chat requests

The default gateway chat deadline is 15 minutes. The frontend proxy waits an
additional 30 seconds so the API can return a structured timeout message.
Export HUD_CHAT_TIMEOUT_MS in both API and Vite processes to override it
(1000 through 3600000 milliseconds). Restart both processes after changing it.
A timeout cancels the HTTP request; inspect any tool actions before retrying.
The GUI does not automatically replay an uncertain request.
