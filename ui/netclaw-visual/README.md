> The current HUD opens on **Chat**. Use the header to switch to **Canvas** or open **OpenClaw ↗** in a separate tab. See the [current HUD guide](../../docs/HUD-FUNCTION-FIRST.md) for conversation retention, native authentication and port-forward requirements. The visual and classic surfaces below remain available.

<p align="center">
  <img src="logos/netclawvisualhud.png" alt="NetClaw Visual HUD — 3D Network Operations Dashboard" width="800">
</p>

# NetClaw Visual HUD

Spec 127 adds a **panel-first dashboard** with Basic/Advanced presentation, dedicated
Risk/peer/mobile/Jev views, optional Three.js relationship maps and the preserved
full Adam Mason canvas. See the [function-first guide](../../docs/HUD-FUNCTION-FIRST.md)
for routes, scope, Jev task binding and verification limits. The earlier scene and
its existing utility controls remain at `/classic.html`; `/canvas.html` stays available.


A Three.js 3D network operations dashboard for [NetClaw](https://github.com/automateyournetwork/netclaw). Visualizes the registered MCP integrations, deployed skills, your device fleet, and live BGP peering topology in a real-time interactive scene. Includes a chat terminal wired directly to the OpenClaw gateway for live tool execution from the browser. Supports bidirectional Slack and WebEx channels.
### Optional observability integrations

Canvas terminal → **Extra Features → Observability integrations** now offers
opt-in Infoblox NIOS network context, ThousandEyes network-test results,
namespace-scoped Kubernetes pod context, and OTLP/HTTP health export. Evidence
appears in the existing hover/side pane without changing normal CLI behavior.
VMware and ExtraHop are explicitly marked planned, not connected.

This is an initial, session-only implementation, tested with synthetic fixtures.
Restart the API to load the new routes, then configure and authorize providers in
the GUI. See [OBSERVABILITY.md](OBSERVABILITY.md) for supported scopes, privacy,
limitations, validation and optional Kubernetes Collector / RBAC examples.

### Terminal JSON uses pyATS / Genie

In Canvas, open **Structured output → Output: JSON**, confirm the full command
and device OS, then choose **Parse with Genie**. The latest captured show/display
response is detected from transcript prompts; a selection without a prompt needs
its command entered manually. This field selects a parser—it does not execute CLI.
Use complete, unfiltered output with its headings. **Create Result** becomes
available only after parsing succeeds. The Result, copy and download preserve
Genie's native JSON structure; no indentation-based nesting is substituted.

The API reuses the existing NetClaw pyATS Python via `PYATS_PYTHON` (default
`python3`), including its installed Genie parsers. No Gemini/LLM, API key, second
pyATS installation, SSH connection or device credentials are involved. The
existing `pyats_run_show_command` MCP tool executes a new device command; this
offline adapter instead calls `Device.parse(command, output=captured_output)` in
the same Python environment. Connect/execute/configure calls are blocked.

For a Windows-hosted API using Linux pyATS, it invokes the existing WSL `Ubuntu`
environment (`PYATS_WSL_DISTRO` overrides the distribution). Set `PYATS_PYTHON` to
the existing Linux virtualenv's absolute Python path when needed. A native Windows
executable path is also honored. This does not enable Windows virtualization or
install any dependencies. Restart the API once after upgrading to enable
`POST /api/terminal/parse/genie`; runtime settings use the existing `.env` files.

For users without a configured environment, the optional
[automated runtime installer](../../docs/GENIE-RUNTIME-SETUP.md) creates an isolated
pyATS/Genie virtualenv and verifies a synthetic parse. It never installs into system
Python or enables WSL/Hyper-V automatically. Native Windows Python is not an
upstream-supported pyATS runtime, even though the adapter accepts executable paths.

Parsing stays local. The endpoint is localhost-only, limits requests to 500 KB,
allows at most two concurrent parsers and times out after 30 seconds. Output is
passed on stdin, not through shell interpolation or temporary transcript files.
Unsupported commands, missing runtimes and invalid/empty parser responses produce
an explicit error, never a synthetic JSON fallback. Genie schema validation and
JSON syntax validation are not proof of device-state accuracy or complete parser
coverage. Other output formats retain their existing behavior.

Verification: `npm run test:genie` tests the adapter/API boundary with mock parser
responses; `python test/genie_adapter_test.py` tests the offline contract with
fake Genie modules. These are not live Genie integration tests.


---

## Table of Contents

1. [Build and Install NetClaw](#1-build-and-install-netclaw)
2. [Start the OpenClaw Gateway](#2-start-the-openclaw-gateway)
3. [Local BGP Peering (Optional)](#3-local-bgp-peering-optional)
4. [Peer with Other NetClaws (Optional)](#4-peer-with-other-netclaws-optional)
5. [Start the Visual HUD](#5-start-the-visual-hud)
6. [Using the HUD](#6-using-the-hud)
7. [Reading the Org Chart](#7-reading-the-org-chart)
8. [Architecture](#architecture)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## 1. Build and Install NetClaw

Before running the HUD, you need a working NetClaw installation with the OpenClaw gateway configured.

### Prerequisites

- **Node.js** compatible with the installed OpenClaw release (Node22 used in spec124 acceptance), and npm
- **Python** 3.10+
- **OpenClaw** CLI installed through the NetClaw installer (the gateway is a Node application, not a Python package)

### Clone and Install

```bash
git clone https://github.com/automateyournetwork/netclaw.git
cd netclaw
./scripts/install.sh
```

The installer runs two setup phases:

**Phase 1: `openclaw onboard`** (OpenClaw's built-in wizard)
- Pick your AI provider (Anthropic, OpenAI, Bedrock, Vertex, 30+ options)
- Set up the gateway (local mode, auth, port)
- Connect channels (Slack, WebEx, Discord, Telegram, etc.)
- Install the daemon service

**Phase 2: `./scripts/setup.sh`** (NetClaw platform credentials)
- Network devices (testbed.yaml editor)
- Platform credentials (pyATS, NetBox, ACI, ISE, ServiceNow, GitHub, Meraki, etc.)
- Your identity (name, role, timezone for USER.md)

### Configuration Files

After setup, your configuration lives in:

| Path | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | Gateway config — auth token, port, channels |
| `~/.openclaw/.env` | All integration credentials and API keys |
| `netclaw/testbed/testbed.yaml` | Device inventory for pyATS |
| `netclaw/IDENTITY.md` | NetClaw identity, ASN, creature type |
| `netclaw/SOUL.md` | Agent personality and operating instructions |

Reconfigure anytime:
- `openclaw configure` — AI provider, gateway, channels
- `./scripts/setup.sh` — network platform credentials

---

## 2. Enable Chat Completions and Start the OpenClaw Gateway

The Visual HUD and Canvas Chat proxy messages through OpenClaw's
OpenAI-compatible chat-completions endpoint. Enable that endpoint once, then
start the gateway in a dedicated terminal:

```bash
cd netclaw
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
openclaw gateway run
```

If the gateway was already running when you changed the setting, restart it.

You should see:

```
[gateway] listening on ws://127.0.0.1:18789
[gateway] agent model: anthropic/claude-sonnet-4-6
```

The gateway must be running for live chat responses and tool execution (Slack messages, GitHub issues, ServiceNow tickets, mind maps, etc.). Without it, the chat falls back to a local heuristic that identifies which integrations and devices are relevant but cannot execute tools.

The chat interfaces report whether the gateway is ready for chat. A reachable
gateway whose chat-completions endpoint is disabled is shown separately from a
fully offline gateway.

---

## 3. Local BGP Peering (Optional)

NetClaw includes a pure-Python BGP daemon (AS 65001) and a Docker-based FRR router lab. When running, the HUD automatically discovers BGP peers and renders them as equal core nodes alongside the local NetClaw in the 3D scene.

Use the [canonical IPv6 FRR lab procedure](../../lab/frr-testbed/README.md) on a disposable lab host. It defines the required Docker networks, IPv6 GRE addresses and route checks. Root-level setup changes host networking; preserve its baseline and required authorization. A fixed delay does not prove routing convergence.

The protocol daemon is installed through the NetClaw installer/shared Python environment. Configure peering through the [peering guide](../../N2N-PEERING-NETCLAWS.md); do not install its dependencies into the OS-managed Python environment. The local read-only API can be inspected with:

```bash
curl -fsS http://localhost:8179/peers | python3 -m json.tool
curl -fsS http://localhost:8179/rib | python3 -m json.tool
```

Route injection and withdrawal are network changes, not HUD health checks. Follow the approved change workflow before invoking them.

---

## 4. Peer with Other NetClaws (Optional)

Multiple NetClaw instances can peer with each other over BGP. Each NetClaw runs its own BGP daemon with a unique AS number. When peered, both HUDs show each other as core nodes with routes fanning out as dendrite wires.

### Remote Peering via ngrok

On the remote NetClaw host, expose the BGP port:

```bash
ngrok tcp 179
```

On the local NetClaw, add the ngrok endpoint as a BGP peer:

```bash
export NETCLAW_BGP_PEERS='[
  {"address":"fd00:ee::0","remote_as":65000},
  {"address":"X.tcp.ngrok.io","remote_as":65002,"remote_port":NNNNN}
]'
python bgp-daemon-v2.py
```

### Direct Peering

If both NetClaws are on the same network or have direct IP connectivity:

```bash
export NETCLAW_BGP_PEERS='[
  {"address":"fd00:ee::0","remote_as":65000},
  {"address":"192.168.1.50","remote_as":65002}
]'
python bgp-daemon-v2.py
```

The HUD renders all BGP peers as equal core nodes in a triangular layout — local NetClaw on the left, peer nodes on the right — each with its received routes displayed as animated dendrite wires.

---

## 5. Start the Visual HUD

### Windows one-command startup

From the NetClaw repository root, double-click `Start-NetClaw.cmd`, or run:

```powershell
.\Start-NetClaw.ps1
```

This starts the OpenClaw Gateway and both Visual HUD processes, waits until
they are ready, and opens Canvas Chat. It is safe to run again: services that
are already listening are reused instead of duplicated. Pass `-Interface HUD`
to open the main dashboard, `-NoBrowser` to skip opening a browser, or
`-SkipGateway` when a separately managed gateway is already available.

### Install Dependencies

```bash
cd netclaw/ui/netclaw-visual
npm install
```

### Development Mode

```bash
npm run dev
```

This starts two processes concurrently:

| Process | Port | Purpose |
|---------|------|---------|
| **API Server** | 3001 | REST API + WebSocket for graph data, BGP state, chat proxy, device config |
| **Vite Dev Server** | 3000 | Three.js frontend with hot reload, proxies `/api` and `/ws` to port 3001 |

Open **http://localhost:3000** in your browser. The default route remains the
3D Visual HUD; the alternative branching chat workspace is available at
**http://localhost:3000/canvas.html**.

### Production Build

```bash
npm run build
npm run preview
```

### What You Need Running

| Component | Required | Command | Purpose |
|-----------|----------|---------|---------|
| **HUD** | Yes | `npm run dev` | The dashboard itself |
| **OpenClaw Gateway** | For live chat | `openclaw gateway run` | AI-powered tool execution |
| **BGP Daemon** | For topology | `python bgp-daemon-v2.py` | BGP peer discovery + routes |
| **FRR Lab** | For router peering | `docker compose up -d` | Lab routers to peer with |

---

## 6. Using the HUD

### Panels, terminal, and mobile

| Control | Behavior |
|---------|----------|
| **Left / right / footer collapse** | Use the ‹ › ↓ chrome buttons; panels slide off-screen. Edge chips **FILTERS** / **DETAIL** / **STATUS** (bottom dock on phones) reopen them. |
| **NetClaw Terminal** | Drag the header to move, corner handle to resize, `_` / `+` to collapse. Desktop position is remembered. |
| **Mobile** | Narrow / touch viewports get `#app.mobile-layout`: bottom-sheet panels, auto FOCUS quality, capped DPR, terminal as a bottom sheet. |

**Phase H (mobile/PWA/polish H001–H010) is complete.** History + optional notes:

- [`specs/080-convergence/hud-polish-backlog.md`](../../specs/080-convergence/hud-polish-backlog.md)
- Task checkboxes: Phase H in [`specs/080-convergence/tasks.md`](../../specs/080-convergence/tasks.md)

| Extra control | Behavior |
|---------------|----------|
| **Knowledge** | Collapsed by default; on mobile a pill chip expands to a bottom sheet |
| **Quality** | FOCUS / BALANCED / BROADCAST remembered in `localStorage` when you cycle it |
| **Terminal snaps** | On phone: toggle cycles collapsed → peek → expanded (`+` / `□` / `_`); drag header snaps to nearest |

### PWA + offline (H004 / H005)

| Feature | Behavior |
|---------|----------|
| **Install** | `manifest.webmanifest` + icons; Chromium install / iOS Add to Home Screen. Requires **HTTPS** (or `localhost`). |
| **Service worker** | `/sw.js` caches app shell and the last good `/api/graph` only — not chat, secrets, or other APIs. |
| **Stale topology** | Last graph is also stored in `localStorage`. If `/api/graph` fails, the HUD boots with a **STALE** banner (Retry / dismiss). Footer **Updated** shows `STALE …`. Chat still mounts; gateway indicator is independent. |

### Mobile / landscape smoke checklist (H006)

Run in DevTools device mode or on a phone (&lt;10 min):

- [ ] **Phone width ≤720**: `FILTERS` + `DETAIL` chips visible; left filters not permanently gone
- [ ] Collapse / reopen sidebars via chips; only one drawer open at a time
- [ ] Terminal: expand/collapse (`_` / `+`); drag header; resize corner
- [ ] **HOME**: KPIs 2-col, sub-nav / refresh ≥44px touch targets
- [ ] **Landscape**: compact topbar (no long eyebrow); graph/Home keeps most of the short axis; terminal collapses to strip on enter
- [ ] **Long-press** a node (~0.5s, don’t drag): DETAIL sheet opens with selection
- [ ] Drag/orbit still works (long-press cancels if finger moves)
- [ ] **Reduce motion** (OS setting): scan-beam frozen; quality drops to FOCUS if not user-pinned
- [ ] iOS keyboard open does not permanently mis-size the canvas (visualViewport)
- [ ] **PWA**: manifest loads; SW registers on secure context (Application tab)
- [ ] **Stale**: after one successful load, stop HUD API briefly and reload → STALE banner + last topology

### The 3D Scene

The center of the HUD is a Three.js 3D scene. Use your mouse to navigate:

| Action | Control |
|--------|---------|
| **Orbit** | Click and drag (one-finger rotate on touch) |
| **Zoom** | Scroll wheel (pinch on touch) |
| **Select node** | Click on a node (long-press on touch / mobile) |
| **Deselect** | Click the local NetClaw core or empty space |

### Core Nodes

The scene displays up to three central core nodes in a triangular arrangement:

- **NetClaw (Local)** — your local instance, with its registered integrations orbiting around it as colored spheres connected by animated data-flow tubes
- **Peer NetClaw** — another NetClaw instance you're peered with via BGP (magenta tint), with received routes fanning out as dendrite wires
- **Router** — a traditional router peer like FRR Edge1 (cyan tint), also showing its advertised routes

All core nodes have the same visual treatment: icosahedron shell, glowing nucleus, rotating torus rings, and a label. Magenta tubes connect the cores to show BGP peering links.

### Integration Nodes

Each registered MCP integration is rendered as a sphere orbiting the local core, color-coded by category:

| Color | Categories |
|-------|-----------|
| Cyan | Cloud, Device Automation |
| Green | Source of Truth, Governance |
| Orange | Security, Fabric Control |
| Magenta | Observability, Network Platforms |
| Yellow | Labs, Visualization |
| White | Reference, Utilities |

Click any integration node to see its skills, estimated tool count, and configuration status in the right sidebar detail panel.

### Device Nodes

Devices from your `testbed.yaml` appear as smaller nodes connected to the local core. Click a device to see its hostname, OS, platform, IP, and connection details.

### Chat Terminal

The chat drawer in the bottom-right corner connects directly to the OpenClaw gateway:

1. Type a message like `check R1 interfaces make a github report and send a slack message` or `send a WebEx alert about R2 CPU`
2. The HUD identifies which integrations are relevant (pyATS, GitHub, Slack, WebEx) and lights them up in the 3D scene
3. Animated beams fire from the local core to each activated integration
4. The gateway executes the actual tools (runs pyATS commands, creates GitHub issues, sends Slack messages)
5. The response appears in the chat with a **LIVE** badge

If the gateway is offline, responses fall back to a local heuristic with a **LOCAL** badge that identifies relevant integrations and devices but cannot execute tools.

The chat header shows:

- **LIVE** (green) — the gateway and chat-completions endpoint are ready
- **CHAT API DISABLED** (orange) — the gateway is reachable, but its
  chat-completions endpoint must be enabled
- **OFFLINE** (orange) — the gateway is not running or is unreachable

### Canvas Chat (Alternative Interface)

Select **Canvas Chat** in the terminal header, or open `/canvas.html` directly,
to use NetClaw in a spatial, branching workspace. The canvas is an alternative
frontend only: it uses the same `/api/chat` proxy, OpenClaw gateway, configured
model, MCP integrations, skills, and safety controls as the existing terminal.

- Highlight part of an answer and branch it into a focused child conversation.
- Drag, resize, collapse, tile, or automatically tidy conversation windows.
- Select multiple branches and synthesize their context into a new node.
- Attach images or text/code/data files to a turn.
- Keep multiple canvas sessions in browser-local IndexedDB and export/import
  portable JSON when needed.
- Return to the standard NetClaw interface at any time with the **Visual HUD**
  button in the canvas header.

Each canvas request sends the context for its own branch. Sibling branches are
therefore isolated from one another, while the original `{ "message": "..." }`
chat request remains fully backward compatible for the Visual HUD.

### Interactive SSH Terminal

Choose **Tools → New SSH terminal** in Canvas Chat to open a movable,
resizable terminal window. The terminal uses xterm.js for VT/ANSI emulation and
an `ssh2` channel on the NetClaw API server, giving network-device VTY sessions
the same keyboard, cursor, color, scrollback, copy/paste, and resize behavior as
a desktop SSH client.

- Devices and connection endpoints come only from named profiles in
  `testbed/testbed.yaml`; the browser cannot supply an arbitrary host.
- Use **+ Device** in the terminal toolbar to append a validated SSH profile to
  the existing `devices:` mapping. Existing entries, comments, credentials, and
  unrelated testbed structures are preserved; duplicate device IDs are rejected
  rather than overwritten. Adding a profile never opens a connection.
- In **Edit Testbed**, choose **Edit selected device…** to change its display
  name, SSH address/port, device type, OS or platform. The stable device ID is
  read-only. The existing preferred connection (`cli`, then `ssh`) is updated;
  credentials, other connections, custom fields and YAML comments are preserved.
- **Remove selected device…** shows the exact profile and endpoint for
  confirmation before removing only that inventory entry, not the actual device.
  Disconnect that device in all terminal windows first (the API enforces this).
  Both edits and removal revoke only that device's background-collection grant,
  clear its collector login and observations, and cancel pending collection.
  Other devices continue collecting. Edited profiles require fresh authorization.
- Edit/remove writes save the previous inventory in `testbed.yaml.backups/`
  beside the active testbed (or `<custom-testbed-path>.backups`). These local
  backups may contain credentials: keep them private and out of version control.
  Recover an entry by copying its YAML from a backup into the testbed; restoring
  the whole backup also undoes later inventory changes. Backups are not auto-pruned.
  Stale dialogs are rejected: **Reload**, then reopen the editor before retrying.
  Shared YAML aliases that would affect another device are rejected rather than
  rewritten. Unsupported/non-SSH profiles can be selected for removal, but only
  explicit SSH profiles can be edited with this form.
- Restart the API after installing this change, then refresh Canvas. No CML-only
  endpoint rules, production defaults or host-key policies are changed.
- Use **Reload** to pick up profiles added by another editor or inventory
  workflow. NetClaw integrations can query controller and source-of-truth
  inventories, but the terminal does not perform an automatic network scan or
  enroll discovered endpoints without an explicit testbed update.
- Passwords, private keys, and SSH-agent access stay on the NetClaw server and
  are never returned by `/api/terminal/devices`.
- Unknown or changed SSH host keys require an explicit PuTTY-style trust
  decision. Accepted fingerprints are stored locally in
  `~/.openclaw/netclaw-terminal-known-hosts.json`.
- Selecting terminal output opens the same **Branch this** workflow used by
  chat text. The exact terminal cells remain highlighted, the new chat window
  is connected on the Canvas, and the selected output is included in the
  branch's first model request.
- Terminal transcripts, source-highlight ranges, custom names, and window
  layout are saved with the Canvas session in browser IndexedDB. The window
  also supports transcript copy/export, minimize/restore, close/reopen,
  drag/resize, auto-size reset, overview, tiling, and undo/redo.
- Interactive terminal access is restricted to a browser opened through
  `localhost` or `127.0.0.1`.
- SSH VTY and SSH-based console-server profiles are supported. Raw Telnet is
  intentionally unsupported because it would transmit credentials and commands
  without encryption.
- **Extra Features → Inline DNS enrichment** adds an optional presentation-layer
  annotation to IP addresses with a successful PTR record. The original xterm
  buffer, SSH bytes, selection/copy content, transcript, and device logging are
  never changed. PTR resolution happens asynchronously and both successes and
  failures are cached; unresolved addresses remain ordinary terminal text.

#### NetBox / SNOW demonstration tab

Open **NetBox / SNOW demo** beside **Terminal** and **Structured output** to
explore an interactive example of route enrichment. Hover a sample prefix or
next hop in `show ip route` output to open a scrollable popover of tiled NetBox
inventory, ServiceNow (SNOW) records, router observations, and aliases. Move
into the popover to scroll or edit a sample alias; click the route or **Pin**
to hold it open. **Close**, Escape, or clicking outside dismisses it. Keyboard
focus also opens the card, and Tab moves into its controls. All demo records
are fictional. A persistent **FAKE DATA —
DEMONSTRATION ONLY** banner and source-card labels distinguish the sample from
live data. Sample alias edits last only for the current demo view.

This tab uses bundled synthetic data; it does not query NetBox, ServiceNow,
DNS, or a device, and does not add samples to the real terminal transcript,
inventory, or saved aliases. Choose **Terminal** to return to the SSH session.
The demo is an interaction preview, not an enabled live connector.

The normal terminal uses the same hover-card layout for the available route,
DNS, and local-alias information. Synthetic NetBox and ServiceNow tiles appear
only in the demonstration tab.

Route details automatically dock in the unused right side of a wide terminal.
The layout measures the visible output (including canvas zoom) and requires at
least 420 screen pixels of spare width and 240 pixels of height. Long output or
a smaller window falls back to the floating card. Resizing switches layouts
without changing the selected route. Docked details remain open while crossing
the terminal to reach them; hovering another route updates unpinned details.
Tiles scroll independently, and Pin, Close and Escape work in either layout.
Opening details does not resize the SSH terminal or send device commands.

### Terminal selection and canvas zoom

Terminal selection accounts for canvas zoom and panning. The coordinate adapter
in `src/canvas-chat/terminal-mouse-coordinates.js` preserves xterm's native
selection, scrollback and drag-scroll behavior. It uses an isolated private API
boundary, so xterm is pinned to 6.0.0: when upgrading, run
`npm run test:terminal-selection` and open `/test/terminal-selection.html` on the
development server to verify selection at multiple zoom levels and terminal
widths. The fixture uses synthetic text only and makes no device connections.

### Automatic cross-router context (opt-in)

Open **Extra Features → Automatic topology context** in any terminal. Select
the testbed devices, information categories and polling interval, then check consent
and choose **Authorize automatic collection**. This grants standing read-only
access; no transcript imports or manual commands are needed after authorization.
Selected devices expose username/password fields and a **Log in / test credentials**
button in this same panel. Leave both fields blank to use the saved testbed login.
Authorizing also checks any unverified logins and brings the device's inline prompt
into view. Unknown/changed SSH fingerprints require **Trust this key and test login**
after verification with a trusted source; passwords are not transmitted to an
unapproved key. Login checks authenticate only, without opening a shell or
executing commands. Cancel does not approve the fingerprint.

Entered credentials are retained only in API process memory (not browser storage,
testbed YAML, authorization JSON or AI requests). They are cleared on **Stop and
revoke all** or API restart; affected standing grants pause for login after restart.
Saved-testbed credentials may resume automatically. Closing the panel does not
clear credentials needed by a running collector. No encrypted credential vault
or cross-restart password persistence is provided by this flow.

**Stop and revoke all** cancels current collectors, clears observations, and
removes the standing grants. Closing a terminal or browser does not stop the
server-side collector. After deploying this backend change, restart the NetClaw
API once and refresh Canvas.

- **Supported now:** SSH IOS / IOS-XE IPv4 routing tables, default and available
  named VRFs, plus opt-in identifier sources below. Unknown-OS profiles use read-only `show version` detection first;
  other platforms and IPv6 correlation are not implemented. Unsupported profiles
  do not receive IOS collection commands.
- **Information categories:** routing; hostname/software/hardware inventory
  (model, serial, product/revision); interface addresses, descriptions, state,
  rates and error counters; ARP; CDP/LLDP system/chassis IDs, management addresses
  and ports; MAC forwarding/VLAN identifiers; and OSPF/BGP peer summaries.
  The authorization panel lists the exact fixed show commands for each category.
  Existing routing-only grants remain routing-only until explicitly expanded.
  Unsupported commands are reported per source without discarding other results.
- **Read-only transport:** separate SSH shells run `terminal length 0` (only a
  session paging setting) and the selected categories' fixed show commands. Interactive
  user sessions are not reused or modified. Use saved testbed credentials or the
  collector panel's session login, with explicitly verified SSH host keys. One-connection credential
  overrides from the Credentials dialog are not persisted for background use.
- **Authorization boundary:** explicit selection, up to 32 devices; new testbed
  entries are not automatically included. Grants bind device ID, endpoint,
  platform and trusted key. Changed identities and authentication failures pause
  the device until reauthorized, including across restart. Legacy KEX requires
  a separate per-device opt-in. The GUI/API are localhost-only, not a multi-user
  RBAC or remote deployment authorization system.
- **Freshness:** near-real-time polling, not push/streaming telemetry. Default
  interval is 30 seconds after each collection (15–300 seconds configurable),
  with two collectors at once per server instance. Slow devices/fleets can take
  longer. Failed devices back off up to five minutes; failed or aged observations
  are explicitly stale. Hover/docked details refresh every three seconds while
  open, without rerunning a command in the interactive terminal.
- **Correlation:** exact normalized prefix plus VRF across routers; host lookups
  use each router's longest-prefix match per VRF. A next-hop address matching a
  different device's local `/32` produces an evidence-labeled relationship,
  never a claimed physical link or complete forwarding path. Matching VRF names
  within the authorized testbed are assumed to refer to the same context; use
  separate instances for unrelated overlapping networks. Unknown transcript
  VRFs show separately labeled results rather than silently mixing scopes.
- **Identifier correlation:** IP/prefix lookup also joins matching interface and
  neighbor records, device identity, and routing peers. ARP links IPs to MACs;
  authorized switches' forwarding tables can then supply candidate VLAN/port
  associations (authorize both ARP and switching categories for this join).
  Every record identifies the reporting device, command and observation time.
  Route-reporting routers are not presented as owners of every destination IP.
  MAC reuse and disconnected VLAN/site contexts mean a matching MAC is a candidate
  association, not a verified endpoint or forwarding path. Default-VRF ARP and
  peer summaries are not mixed into explicit named-VRF queries; interface-brief
  address matches explicitly note that interface VRF is unknown. Interface error
  counters are cumulative observations, not calculated error rates.
- **Failure visibility:** device status, last successful collection, incomplete
  named-VRF coverage and timestamps are shown. A successful snapshot replaces
  old routes (withdrawals disappear); each identifier source has independent
  freshness and replacement, with stale prior records retained on failure.
  Failed parsing never turns a malformed
  response into an empty current routing table. IPv4 RIB correlations do not
  prove L2 adjacency, reachability, policy-routing behavior, or FIB installation.
- **Local storage:** bounded authorization history and grants are in
  `$OPENCLAW_HOME/netclaw-topology-authorization.json` (default
  `~/.openclaw/netclaw-topology-authorization.json`); override with
  `NETCLAW_TOPOLOGY_FILE`. No new credential copies are saved, and full running
  configurations are not collected. Route and identifier observations
  live in process memory, are recollected after restart, and are never sent to
  an AI provider, NetBox or ServiceNow. Run one collector-enabled API instance
  per authorization file to avoid duplicate polling.

Tests: `npm run test:topology`, `npm run test:topology-facts` and
`npm run test:topology-api`. The latter uses
a synthetic loopback-only SSH router and isolated testbed/authorization files;
it does not contact the user's routers. NetBox / SNOW remains a separate,
clearly labeled synthetic demo; these connectors are not enabled by collection.

Interactive terminal commands are sent directly to the selected device.
Background collection runs only the authorized read-only command categories;
it never bypasses change-control requirements for configuration changes.

Run the self-contained mock-SSH validation without touching a real device:

```bash
npm run test:terminal
npm run test:enrichment
```

### English Terminal Intent

Choose **English intent** from the SSH window's **Structured output** format
dropdown to add a plain-English layer over terminal output. Selecting the mode
translates the selected output, or the current visible transcript, into concise
operational meaning. **Explain output** refreshes that interpretation after
additional commands. The same preview includes a composer for English requests
such as “show me the BGP neighbor state.”

NetClaw returns an explanation plus exact CLI as a proposal. Commands are
classified as read-only, configuration, destructive, or unknown. A proposal is
executed automatically only when both the model and NetClaw's local command
classifier identify every command as read-only and the SSH session is already
connected. NetClaw captures the resulting terminal stream and adds a second
English-intent response containing the executed command, a plain-English
interpretation of what the device reported, important findings, and an
expandable copy of the exact terminal output. Configuration, destructive, and
unknown-risk proposals require the operator to review the exact CLI, select the
approval checkbox, and choose **Send configuration**. Any proposal can be
copied without opening a connection.

Intent requests send the selected terminal context to the model configured
behind NetClaw's existing `/api/chat` endpoint. Terminal output is treated as
untrusted data, multi-line or control-character commands are rejected, and a
local risk classifier can raise a model's reported risk level.

### Instant Assist terminal mode

The terminal toolbar's **AI** selector defaults to **NetClaw Gateway**. Select
**Instant Assist** to use the direct `chat-latest` terminal-intent path. This
alias follows the newest Instant model used in ChatGPT for fast English-to-CLI
proposals and terminal-output explanations. This mode is deliberately limited to the English-intent panel:
it does not receive SSH credentials and does not change direct terminal input.

Choose **Set up Instant Assist** in the terminal toolbar and paste the API key into the
local-only dialog. Canvas stores it as `NETCLAW_TERRA_API_KEY` in the local
OpenClaw configuration and never sends it back to the browser after saving.
Advanced users can still configure `OPENAI_API_KEY` or `NETCLAW_TERRA_API_KEY`
in `~/.openclaw/.env`. The selected terminal context is sent to
OpenAI only when Instant Assist is selected. NetClaw's local command-risk check
still controls execution: read-only CLI can run automatically on a connected
session, while configuration, destructive, and unknown-risk CLI still require
explicit review and **Send configuration**.

Run the intent parsing and safety tests with:

```bash
npm run test:intent
```

### Structured Results

Terminal output can be promoted into a durable, graph-connected artifact instead
of remaining buried in a transcript.

1. Select the relevant terminal text, or leave it unselected to use the visible
   transcript.
2. Open **Structured output** in the terminal window.
3. Choose JSON, JSONL, YAML, XML, CSV, or raw text, review the live preview, and
   choose **Create Result**.

The new Result window records its source terminal, validation state, record
count, version, size, and creation time. Result actions support copy, download,
conversion to another supported format, and branching into a new chat with the
artifact attached as context. Results remain discoverable in the persistent
right-side **Results** rail even when their graph windows are hidden.

Indented network configuration is represented as nested command/children
sections by default. Flat command output remains a simple entry list. JSONL
emits nested section records, while CSV uses parent/command columns to retain
the relationship without adding synthetic line numbers.

Results are stored in the same browser-local Canvas session as conversations
and terminal transcripts. Review terminal output before sharing an exported
artifact because it can contain device configuration or other sensitive data.

Run the artifact format tests with:

```bash
npm run test:artifacts
```

### Configuration Review Workspace

Choose **Tools → New configuration review** to paste or import an existing
running configuration into a movable Canvas window. To hand off terminal output
directly, select the relevant configuration text in an SSH window and choose
**Review config**; when nothing is selected, the visible terminal buffer is
used.

- The imported configuration becomes an immutable source when review begins.
  Review notes are stored separately, so comments cannot accidentally become
  device commands.
- Select a configuration line and press **Enter**, or click its **+**, to insert
  a multiline comment between that line and the next.
- Source search, source replacement, original-config download, Markdown review
  export, minimize/restore, close/reopen, drag/resize, tiling, overview, and
  undo/redo are supported.
- Source text, anchored comments, and layout persist with the browser-local
  Canvas session.
- Exported Markdown is explicitly marked as a review artifact that must not be
  applied to a device.

Company synchronization is deliberately not represented as enabled. NetClaw
Visual currently has no authenticated human-user identity or HTTP RBAC layer;
N2N grants authorize agent peers rather than web users. Until an identity and
authorization provider is selected, the supported sharing path is to export the
review package into a company Git repository and rely on that repository's
existing team permissions, reviews, and audit history.

### Top Bar Metrics

The header displays real-time counts:
- **Integrations** — number of configured MCP integrations
- **Skills** — total skills loaded from workspace/skills/
- **Devices** — devices in your testbed.yaml
- **Tool Est.** — estimated total tools across all integrations

### Left Sidebar — Filters

- **Search** — filter integrations and devices by name
- **Category toggles** — show/hide integration groups (Cloud, Security, Governance, etc.)
- **Settings** — view and edit integration configuration

### Right Sidebar — Detail Panel

Three focus tabs at the top:
- **Integrations** — list of all integrations, click to inspect
- **Devices** — list of all testbed devices, click to inspect
- **Overview** — summary of all core nodes, BGP state, and route counts

The detail panel below shows context for the selected node:
- **Integration selected**: skills, tools, config status, category
- **Device selected**: hostname, OS, platform, IP, credentials status
- **Peer core selected**: ASN, router-id, BGP state, Adj-RIB-In route table with prefix, next-hop, and AS path

### Footer — Status Bar

- **Model** — the AI model powering the gateway
- **Gateway** — gateway connection status
- **Socket** — WebSocket connection state (CONNECTED / RECONNECTING)
- **Updated** — timestamp of last data refresh

---

## 7. Reading the Org Chart

The HUD renders your NetClaw's **trust topology** as a top-down org chart. It
replaced an orbiting-cores scene in feature 072; the layout is planar and the
camera cannot rotate, because "external vs internal" only reads if the layout
and the viewer agree on which way is up.

### The three bands

```
  ══════ EXTERNAL — eN2N peers ══════      above the boundary: other orgs
  ─────── TRUST BOUNDARY ────────────      drawn explicitly, not implied
        [ BORDER ]   ╌╌► [ edges ]         you, plus mobile devices
  ─────── INTERNAL — iN2N members ────      your own claws, by category
```

Peers north of the boundary are **outside your organisation**. The Border is
you. Member claws fan out below, grouped into categories. Mobile edge devices
get their own lane beside the Border — inside the boundary, but not part of the
member chart, because a phone receives pushes rather than serving delegations.

### Claw health — four states

| | State | Meaning |
|---|---|---|
| ● | **Hot** | Running now |
| ◆ | **Warm** | Seen within 15 minutes; idle, not a fault |
| ▬ | **Cold** | Never started — inert **by design**, entirely normal |
| ◻ | **Fault** | Was reachable, no longer is — needs attention |

Cold and Fault are deliberately kept apart. Most claws are cold on purpose
(on-demand), so merging the two would bury a genuine fault inside a crowd of
healthy-but-idle ones. Fault is the most prominent state after Hot for exactly
that reason.

States differ in **shape, colour and motion at once**, never opacity alone, so
the encoding survives a greyscale screenshot and `prefers-reduced-motion`.

### Categories are derived, not configured

A member's category comes from the skills it holds, matched against the shipped
integration catalog (`server.js`, ~70 integrations across 22 categories). No
member names are hardcoded anywhere, so the chart works on a deployment it has
never seen. A claw whose skills match nothing lands in **Uncategorised** rather
than being dropped.

Categories are ordered by heat, then size — but **only once, at load**. Live
updates repaint; they never move anything. A claw that fails changes how it
looks, never where it is.

### Interacting

| Action | Result |
|---|---|
| **Click a claw** | Opens its detail panel *and* reveals its tools |
| **Drag** | Pans. Rotation is disabled by design |
| **Scroll** | Zooms |
| **Search** | Matches claws, categories and tool names — highlights in place, never hides or re-packs |
| **Tab / arrows** | Moves between and within bands |
| **Enter** | Selects |
| **`e`** | Expands tools without selecting |

Cold claws expand too: what a cold claw *would* bring is exactly what tells you
whether to warm it.

### Development

```bash
npm test                       # pure layout logic — no browser, no GPU
npm run dev                    # API :3001 + vite :3000
```

Load a fixture instead of live data — useful for an empty first-run view or the
100-member ceiling:

```
http://localhost:3000/?fixture=empty
http://localhost:3000/?fixture=scale-100
```

Fixtures live in `specs/072-hud-2-org-chart/fixtures/` and always render a
banner, so synthetic data can never be mistaken for your real Border.

Layout logic under `src/orgchart/` is pure — it imports nothing from three.js
and holds no DOM references, which is what lets it be unit tested. Rendering
lives in `src/orgchart-render/` and consumes that output without re-deriving it.
Keep that boundary; the test suite runs in bare Node and will fail if it breaks.

---

## Architecture

### Renderer stack

| Component | Version / choice | Notes |
|---|---|---|
| `three` | **0.185.1** | Bumped from `0.170.0` by spec 101. Fifteen releases; zero source changes were required, because every breaking change in r171–r185 lands in TSL / WebGPU node materials, which this HUD does not use. |
| Renderer | `WebGLRenderer` | **Not** `WebGPURenderer`. That migration is spec 102: `WebGPURenderer` supports neither raw-GLSL `ShaderMaterial` (this HUD has 4) nor `EffectComposer` (this HUD has a 7-pass chain), so it is an either/or rather than an upgrade. |
| Post-processing | `EffectComposer` | `RenderPass` → `UnrealBloomPass` → `ShaderPass`×2 (vignette, RGB-shift) → `AfterimagePass` → `FilmPass` → `GlitchPass` → `SMAAPass` → `OutputPass`. |
| Labels | `CSS2DRenderer` | DOM overlay, so labels stay crisp and selectable. |
| Camera | `OrbitControls`, zoom `0.35`–`6.0` | Constrained by spec 072 so the org-chart hierarchy always reads. |

`src/orgchart/` is **pure logic and must never import three.js**; `src/orgchart-render/`
owns every three.js contact. That split (spec 072) is what makes the layout, health
classification, liveness and staleness rules unit-testable — the render modules have no
automated coverage, so anything that can be a decision belongs on the pure side.

```
Browser (Visual HUD + Canvas Chat @ localhost:3000)
    |
    +-- GET  /api/graph          -> integrations, skills, devices, tool counts
    +-- GET  /api/bgp            -> BGP peers + RIB from daemon (localhost:8179)
    +-- GET  /api/gateway/status -> OpenClaw chat readiness check
    +-- POST /api/chat           -> linear message or branch context, proxied to OpenClaw
    +-- GET  /api/testbed/raw    -> read/edit testbed.yaml
    +-- PUT  /api/env            -> update integration credentials
    +-- WS   /ws                 -> graph events plus local interactive SSH terminal I/O
    |
    +-- API Server (Express @ localhost:3001)
    |     +-- Reads ~/.openclaw/ for gateway config and credentials
    |     +-- Reads workspace/skills/ for skill catalog
    |     +-- Reads testbed/testbed.yaml for device inventory
    |     +-- Polls BGP daemon at localhost:8179
    |
    +-- OpenClaw Gateway (@ localhost:18789)
          +-- Anthropic Claude (agent model)
          +-- Registered MCP integrations (pyATS, ACI, ISE, NetBox, GitHub, Slack, ...)
          +-- Deployed skills (health checks, troubleshooting, auditing, ...)
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/graph` | GET | Full integration + device graph for 3D visualization |
| `/api/bgp` | GET | BGP peer state and RIB from daemon |
| `/api/gateway/status` | GET | OpenClaw reachability and chat-completions readiness |
| `/api/terminal/devices` | GET | Sanitized SSH profiles from `testbed.yaml` (no credentials) |
| `/api/terminal/devices` | POST | Append a validated SSH profile to the existing `devices:` mapping |
| `/api/skill/:skillId` | GET | Individual skill details |
| `/api/env/:integrationId` | GET | Integration environment variables |
| `/api/env` | PUT | Update integration credentials |
| `/api/testbed/raw` | GET | Read testbed.yaml |
| `/api/testbed/raw` | PUT | Update testbed.yaml |
| `/api/chat` | POST | Send `{ message }`, or `{ message, messages }` with branch-isolated context, to the OpenClaw gateway |
| `/api/chat/history` | GET | Chat message history |
| `/api/sessions` | GET | OpenClaw agent sessions |
| `/api/session/:id/tools` | GET | Tools used in a session |

---

## Troubleshooting

**Chat shows LOCAL instead of LIVE**
- Verify the gateway is running: `curl http://127.0.0.1:18789/v1/models`
- Check the gateway status indicator in the chat header (LIVE/OFFLINE)
- Complex multi-tool queries can take 2-3 minutes — the timeout is set to 5 minutes

**No BGP peers in the visualization**
- Verify the BGP daemon is running: `curl http://localhost:8179/peers`
- Check that peers show `"state": "Established"`
- If using the FRR lab, ensure GRE tunnel is up: `ping -6 fd00:ee::0`

**Integrations show zero tools**
- Run `./scripts/setup.sh` to configure integration credentials
- Check `~/.openclaw/.env` for required API keys and tokens

**HUD won't load**
- Check both processes are running: API on 3001, Vite on 3000
- Look at browser console for Three.js or WebSocket errors
- Verify `npm install` completed without errors

**Scene is blank or nodes are missing**
- Check browser console for `fetch` errors to `/api/graph`
- Ensure the API server started (look for `NetClaw visual API listening on http://localhost:3001`)
- Try a hard refresh (Ctrl+Shift+R)

---

## Twitter Panel

The Visual HUD includes an optional Twitter panel that displays NetClaw's outbound tweets in real-time.

### Features

- **Real-time updates** — New tweets appear instantly via WebSocket
- **Rate limit display** — Shows remaining tweets (Free tier: 50/24hr)
- **Category icons** — Visual indicators for content type (tip, hot_take, til, achievement, musing, community)
- **Heartbeat badge** — Identifies autonomous heartbeat tweets
- **Direct links** — Click through to view tweets on X/Twitter

### Integration

The Twitter panel module is located at `src/panels/TwitterPanel.js`. To integrate:

```javascript
import { TwitterPanel } from './panels/TwitterPanel.js';

// Initialize with WebSocket connection
const twitterPanel = new TwitterPanel(state.socket);

// Mount to DOM
document.body.appendChild(twitterPanel.render());

// Or add manually
twitterPanel.addTweet({
  tweet_id: '1234567890',
  content: 'OSPF tip: Always verify network types match... #netclaw',
  category: 'tip',
  is_heartbeat: true
});
```

### Styling

Import the CSS for panel styling:

```html
<link rel="stylesheet" href="src/panels/TwitterPanel.css">
```

### WebSocket Events

The panel listens for these WebSocket message types:

| Type | Payload | Purpose |
|------|---------|---------|
| `twitter_update` | `{tweet_id, content, category, timestamp, url, is_heartbeat}` | New tweet posted |
| `twitter_rate_limit` | `{remaining, limit, reset_time}` | Rate limit status update |

### Configuration

The Twitter panel requires the twitter-mcp server to be configured with valid credentials:

```bash
# In ~/.openclaw/.env
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
TWITTER_HEARTBEAT_ENABLED=true  # Optional: enable autonomous tweets
```


Spec 127 adds direct RAG uploads/search, masked Configuration, exact Claw MCP/LLM
inspectors, Tokenomics, bounded service Logs, and Documentation with Sean's guide,
CLI/MCP references and [HUD OpenAPI](../../docs/reference/hud-openapi.json).
[Logging guide](../../docs/LOGGING-GUIDE.md) · [Function-first guide](../../docs/HUD-FUNCTION-FIRST.md).
Regenerate references with `python3 scripts/build-hud-reference.py` from repo root.
