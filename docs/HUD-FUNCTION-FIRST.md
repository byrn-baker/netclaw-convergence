# Function-first HUD (specs 127 and 130)

The HUD opens on standard Chat, with the operations Overview one click away. Basic emphasizes common investigations;
Advanced adds technical detail and more navigation. Both retain the same operational
permissions, change-management gates and evidence boundaries.

## Open locally

From `ui/netclaw-visual`, run `npm run dev`. Default UI: `http://localhost:3000`;
API: loopback port 3001. Existing `HUD_UI_PORT` / `HUD_PORT` overrides still apply.
For a trusted LAN, select a concrete interface with `HUD_HOST=<host-IP> npm run dev`.
See [HUD access](HUD-ACCESS.md) for the trust boundary and authenticated SSH alternative.

- `/` — standard Chat, dashboard, capability search, RISK, neighbours, mobile, Jev, network,
  knowledge, operations, RAG, Configuration and settings.
- `/canvas.html` — the complete Canvas context/chat workspace, with the existing
  session library, branches, synthesis, attachments and four answer tabs.
- `/classic.html` — previous HUD, including its RAG upload, configuration,
  budget, layout, Zoom and other utility controls.
- `/assessment.html` — an authorized assessment opened from a canvas message.

The dashboard keeps its Canvas iframe mounted across view/mode changes. “Investigate
in canvas” prepares source-attributed context; “Add to canvas draft” appends it to the
active draft. Neither action sends a message or runs a tool. Canvas session changes
remain blocked during pending replies/saves. The original IndexedDB database name,
version, object stores and direct canvas origin are unchanged. Import/export keeps
message content and relationships; imported assessment references lose authority.

## Choose a chat interface

The header offers **Chat**, **Canvas**, and **OpenClaw ↗** in both Basic and Advanced modes.

- **Chat** is the default: a chronological conversation with the configured gateway. Enter sends; Shift+Enter adds a line. The transcript, draft and in-flight reply stay intact while you navigate this HUD tab. Reload restores the saved view in the same browser tab; gateway-side records follow runtime retention. New chat asks for confirmation and creates a separate thread; it does not delete gateway records. The latest 40 messages are sent as context. Missing or unconfirmed gateway replies are errors, never substitute assistant evidence. There is no automatic retry or request cancellation.
- **Canvas** remains the full branching workspace. Its iframe stays mounted after first use. Existing IndexedDB sessions and drafts are unchanged. Evidence-selection actions continue to hand context to a Canvas draft for review.
- **OpenClaw ↗** opens the native Control UI in a separate tab; it deliberately retains its own authentication and conversation history. OpenClaw denies iframe embedding. The HUD does not strip those headers, expose a token, or change origin/auth settings. The destination uses only the configured gateway port, validated `gateway.controlUi.basePath` and `gateway.tls.enabled`, on `127.0.0.1`. It is configured navigation, not a reachability claim. Missing/malformed configuration or `gateway.controlUi.enabled=false` disables the link. Unsupported paths should be opened through OpenClaw directly.

For remote use through an SSH tunnel, forward the configured gateway port as well as the HUD ports. The interfaces do not synchronize histories or transfer drafts. Opening a tab or changing views never sends a prompt. Detailed Jev links in standard Chat use only the task-bound references returned by the existing API.

## What the views mean

Members execute within their scope. Mobile devices are edge members; Jev is a
separate advisor. External neighbours represent another operator's boundary.
A capability catalogue entry is not a successful connection check. Empty, unavailable
and stale sources remain explicit. Testbed devices are configured inventory, not
observed health. Budget estimates describe the existing runtime estimator's latest
session; they do not claim to be the current canvas's task bill. GCF character
measurements and token estimates remain distinct in requested investigations.

Three.js is optional and loads only when selected. Membership/federation and BGP
session maps are separate from physical cabling. Both share records with the tables.
There is no automatic traffic animation or fabricated path. Tables remain available
without WebGL; reduced-motion users get the same static view and controls.

## Detailed Jev access

The loopback-only bootstrap `POST /api/hud/session` issues a random HttpOnly,
SameSite=Strict cookie. It identifies this browser's local authenticated HUD session;
it is not an internet login or a multi-operator identity provider. Private mapping
records live in `~/.openclaw/hud-bindings` (0700 directory, 0600 files), expire after
30 days and can be revoked with `POST /api/hud/session/revoke`. Reload the canvas
after revocation to establish a new session. No token is placed in canvas exports.

Each canvas thread maps to a server-generated gateway session key. The installed
OpenClaw implementation supports `x-openclaw-session-key`; the server uses that
header and resolves the exact `sessions.json` mapping to the transcript. Only a
new, matching `jev_evaluate` runtime tool result can attach an assessment ID to the
returned message. A failed baseline read, unsupported runtime envelope, CLI-only
tool wrapper or missing mapping produces **unbound**, never a timestamp guess.
This path still needs real gateway acceptance on each deployed runtime.

`GET /api/hud/tasks/:taskRef/assessments/:assessmentId` checks cookie/task/assessment
ownership, uses a dedicated `jev_assessment` MCP invocation and returns allowlisted
fields with `Cache-Control: no-store`. At most four detail reads run concurrently.
The MCP process receives an operator-only `--read-task-id` after literal environment
loading; its `jev_evaluate` tool refuses all calls. Neither reading a record nor
opening the HUD invokes paid inference. Existing budget identity is retained: an
unscoped evaluation stays visibly in the conservative shared budget case.

Original/reconsideration comparison requires both records in the owned task and
validated one-level lineage. Provider questions and typed judgments are separate
from Border-authored interpretation. Border may supply a `jev-influence` block with
an actual assessment ID, status and explanation; the server associates it only with
proven tool results and displays its explanation as ordinary text. Missing influence
is “not recorded.” No prose or influence block grants assessment access.

Global chat activation/history paths do not receive scoped canvas messages or private
tool outputs. The previous global latest-transcript broadcast is no longer invoked.
The legacy tool-history route refuses mapped HUD transcripts and omits Jev tool
results. Authorized detail reads attempt a bounded GAIT audit containing identifiers
only; the UI reports if recording was unavailable.

## Local preview and acceptance

`node src/dashboard/preview-build.mjs` from the HUD directory writes
`/tmp/netclaw-hud127-preview.html`. It bundles the working dashboard with a prominent
synthetic-data banner. This portable review artifact performs no live operation;
Canvas and its saved sessions are tested in the real app, not simulated in that file.

This implementation has automated model, DOM interaction, storage-boundary,
authorization and real read-only MCP tests. See
[the verification record](../specs/127-function-first-hud/verification.md) for exact
results and blocked acceptance. Do not equate a passing build or portable preview
with verified browser layout, production gateway behavior, native Linux, WSL or a
real mobile device.

## RAG and Configuration

Both destinations are visible in Basic and Advanced. RAG uploads one supported file
through the existing multipart ingestion endpoint, accepts a title/document type,
and refreshes document status every ten seconds while its view is open. HTTP 202
means accepted/pending, not indexed. Local documents, captured snapshots and peer
replicas appear separately with source and age metadata. Retrieval uses
`POST /api/rag/search` (query, collection, top five results), with bounded input and
two concurrent reads. This calls only `rag_search`, displays cited excerpts and
low-confidence/staleness markers, and can send selected evidence to Canvas's draft
review. It does not send the draft or mutate remote peer collections. Upload/search
errors remain visible. The portable preview disables upload and marks sample search
results as synthetic.

Configuration is a read-only inventory through `GET /api/hud/configuration` under
the same local Host/Origin guards. It lists known integration variables, additional
stored .env keys, related paths, and set/unset state. No environment value or secret
fragment is returned. OpenClaw's .env overrides repository .env per key; process
environment overrides may differ. The view does not edit files or test credentials.

## Claw MCP and model drill-down

The Risk/mobile/neighbour inspector shows reported MCP servers, tool names and
model identity from that exact entity's inventory. Peer reports use the existing
cached capability card (`inventory.inventory`), retain received time/staleness,
and keep advertisement separate from authorization. Local runtime MCPs and the
configured primary/fallback models appear in Integrations. Credentials, command
lines, URLs and environment values are excluded from the runtime projection.
Repository tool signatures are an explicitly separate reference; missing runtime
schemas are not filled with guessed schemas or inferred tools.

Updated agent members send a bounded, content-free configuration inventory over
the existing authenticated `n2n/inventory` method after connecting to Border.
Border stores it in that channel member's health record, and `/n2n/members` exposes
its allowlisted names/model and receipt time. Reported fields never change member
scope, routing authority or permissions. Old members remain unreported until an
updated member reconnects. Mobile edges have no local LLM runtime. No running
member or daemon was restarted as part of this local implementation.

## Tokenomics

`GET /api/hud/tokenomics` aggregates recognized OpenClaw assistant `message.usage`
records from at most 200 recent local main-agent transcript files, capped at 2 MiB
per file and 32 MiB per read, cached for 30 seconds. Only provider/model names,
recorded input/output/cache counters, recorded cost and coverage counts leave the
reader; no conversation content or session identifiers are returned. Missing usage,
partial token fields, skipped files and malformed lines remain visible. Retained
records can span multiple dates; this is not a calendar-day or invoice total.
No remote-member spend is attributed to the local gateway. Jev daily/task budgets
are a separate ledger. The existing latest-session estimate is labeled with its
$0.17-per-assistant-turn heuristic and is never substituted for recorded usage.

## Logs and Documentation

[Logging and troubleshooting](LOGGING-GUIDE.md) documents fixed service sources,
read limits, redaction, copyable commands, Linux journal filters, log-related scripts
and collector selection. Logs supports manual/opt-in refresh, literal search,
severity filtering and exact-line evidence handoff into Canvas's draft review.
The reader accepts no arbitrary path, unit or shell command. Live system logs may
still contain private operational details despite credential-pattern redaction.

Documentation includes indexed local README/guides/skills, an attributed panel for
[Sean Mahoney's guide](https://www.seanmahoney.ai/guides/netclaw-overview/), modalities,
searchable source-derived CLI/MCP references and a HUD OpenAPI route inventory.
Generate these artifacts with `python3 scripts/build-hud-reference.py` after
interface changes. CLI declaration extraction never runs scripts. Source declarations
can include delegated-command flags; external/version-specific CLI help and dynamic
MCP tools/list remain authoritative. The OpenAPI inventory covers registered HUD
HTTP routes; general payload schemas are deliberately unspecified, with explicit
schemas for RAG search/upload. Daemon route conditions are provided separately;
MCP JSON-RPC methods are not incorrectly advertised as REST routes.

The documentation API reads only indexed repository paths, denies traversal and
symlink substitutions, and renders text/links without injecting document HTML.
The portable preview includes README, HUD/logging guides and the CLI reference;
other guide content is available through the real application or repository.

## Early operating-mode summary and Security

Overview shows LAB bypass, configured federation mode and observed enforcement.
The Security destination reads only safe mode enums/booleans, reports DefenseClaw
configuration/probe details, exposes fixed read-only OpenShell status/list output,
and links to service-specific log sources and configuration/setup guides. Missing
or stale posture never becomes production-enforced; a LAB bypass remains visible
alongside production reports. OpenShell is distinct from systemd member confinement.
See [Security modes](SECURITY-MODES.md) for exact setting locations and behavior.
No mode switch, policy write, service restart or sandbox creation occurs from viewing
these panels. OpenShell status probes have fixed arguments, time/output limits and
30-second caching. This is read-only configuration review, not a deployment editor.

## Upgrade HUD assets from an updated checkout

```sh
scripts/upgrade-hud.sh --check
scripts/upgrade-hud.sh --apply
# If dependencies need installing from the existing lockfile:
scripts/upgrade-hud.sh --apply --install-deps
```

Node.js 22+, npm, Python 3 and Git are required. `--repo PATH` selects another
checkout; no Git fetch/pull is performed. Check mode makes no changes. Apply
regenerates references, builds, and verifies dashboard/Canvas/classic/assessment
outputs. Failures return nonzero. No .env/security configuration, browser storage
or service is altered; keep the same hostname/port for existing Canvas data.
Restart the existing HUD process through the normal operator workflow, then verify
live sources. Agent members require their own update/reconnect for new metadata.
This is a scoped asset upgrade helper, not the planned whole-installation utility.

## Choose a model in Chat

The Model selector in the bottom toolbar of the standard Chat composer applies to the next
message. Agent default follows the selected agent's configured primary model.
Other choices come from the selected agent's available runtime catalog, with configured
references retained as a fallback if discovery fails. The adjacent effort slider uses
supported reasoning levels for the chosen model; it is not a price ranking. Runtime
account pricing is not available. Native Codex metadata narrows supported levels when
available. Settings are validated and applied to the private gateway session before
inference, without changing global defaults. A failed settings change stops the send.
Use default effort clears the override. Controls stay locked while a reply is pending.
Refresh models reloads the catalog, which is coalesced and cached for up to one minute.
Canvas retains its existing agent-default behavior.

## Context and account usage

The bottom composer toolbar includes context and quota indicators. Open their
details for the last recorded session context, context capacity, provider quota
windows, remaining percentages, reset times and source timestamps.

Context uses OpenClaw's fresh totalTokens and contextTokens for this browser-owned
chat only. It does not include unsent draft text or sum billing tokens. A new
chat, stale runtime count, changed model or missing capacity is shown as
unavailable until matching data is reported. Provider quotas are shared account
limits, not chat spending budgets; unsupported quota reports are unavailable.

Reads are bounded and coalesced. Provider reports are cached for five minutes;
session reads for 15 seconds. The active visible Chat view refreshes every 30
seconds and after turn state changes. Hidden views do not poll. Account emails,
billing details and other sessions are never projected to the browser.

## Runtime Settings and chat refresh

Settings reads the actual OpenClaw configuration under OPENCLAW_HOME (default
~/.openclaw), including the selected agent's model and workspace overrides.
The source path is displayed. Only safe display fields are returned; missing
configuration is unavailable rather than replaced with repository examples.

Standard Chat saves the conversation, draft, model, effort and thread identifier
in sessionStorage for the current origin and browser tab. Refresh restores them.
New chat preserves previous conversations and drafts in a bounded per-tab archive
(up to 100 entries / 4 MiB); storage failures are visible and prevent switching away
from an unsaved chat. No uncertain request is automatically resent.

Use **Previous chats** above the transcript to reopen a browser-owned gateway
conversation. **Refresh chats** reloads the index; **Reload chat** retrieves replies
that arrived while the page was closed. The original gateway session key is retained
for follow-ups, including legacy bindings that use a server-issued resume alias.
Models, effort and local drafts are restored. Running sessions must be reloaded before
sending another message. Tool output, system messages and reasoning are excluded from
the visible transcript. Display reads are bounded to 1,000 entries / 2 MiB, with a
notice when older transcript entries are omitted; runtime context retention is
unchanged.

The gateway history index is limited to the selected agent and the owning private
browser cookie. It works across tabs sharing that cookie; drafts remain per-tab.
Unbound legacy conversations, expired or different browser cookies, and deleted
gateway transcripts are not automatically recovered. Browser-only history cannot be
recovered after its storage is cleared.
