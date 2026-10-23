# Verification

2026-10-01:
- Targeted local access and real server access: 6 passed.
- Added Vite HTTP/WebSocket proxy integration test: passed. Native HTTP is used for the hostile Host case because this Node version's fetch did not transmit the supplied Host override.
- npm test: 291 passed, zero failures.
- npm run build: passed; existing large-chunk warning remains.
- Live development server bound to the Ethernet IP on port 3000; API still 127.0.0.1:3001.
- From this host through its Ethernet address: UI and /api/health returned HTTP 200; /ws connected; an untrusted Origin returned HTTP 403.
- git diff --check passed.
- GAIT audit recorded under /tmp/netclaw-134-audit.

A second computer/browser and intervening network/firewall rules were not tested. This opt-in does not provide login/TLS. No device or model calls were made. The existing OpenClaw native link still needs separate gateway access.

## HTTP LAN browser follow-up

The initial HTTP/WS checks missed a browser-only failure. Chromium reproduced a blank page with `globalThis.crypto.randomUUID is not a function`. On the HTTP Ethernet origin, `isSecureContext` is false and `randomUUID` is unavailable.

Added a shared UUIDv4 generator using `crypto.getRandomValues` when native `randomUUID` is unavailable. Standard Chat, terminal IDs and topology-image IDs use it.

- Real Chromium at the HTTP Ethernet URL after the fix: no page errors, Standard Chat heading rendered once, body content rendered.
- Browser environment remained insecure-context with randomUUID undefined; no browser security bypass was used.
- npm test: 293 passed, zero failed.
- npm run build: passed with the existing chunk-size warning.
- A second physical computer remains unverified. No chat was sent and no device operation was run.
- Browser tooling was isolated under /tmp/netclaw-134-browser, not added to project dependencies.

## Gateway and secondary route recovery

The gateway had been OOM-killed, then could not restart because five Cloudflare MCP URLs used unsupported mcp:// placeholders. Backed up the private runtime config, quarantined those entries in a private adjacent file, enabled gateway.http.endpoints.chatCompletions.enabled and restarted the user service. Runtime configuration validates; optional integrations still report missing settings. The template placeholders remain an upstream installer concern; this recovery does not claim to configure Cloudflare integrations or resolve the historical memory-pressure cause.

Secondary terminal/observability guards now reuse the shared API policy when HUD_HOST is explicitly set. This admits the configured UI proxy without admitting direct remote API sockets.

Verification: 294 UI tests passed; standalone terminal request-policy suite passed; git diff --check passed. Real Chromium over Ethernet shows Gateway available, no page errors or HTTP failures on initial load. Read-only terminal devices, Terra status and gateway status return HTTP 200. Gateway /readyz reports ready=true, no failing checks, service active with zero restarts since recovery. No device commands or model requests were issued; sustained memory behavior and all optional integrations are unverified.

## Actual chat acceptance

A real compatibility request returned HTTP 400 Unknown agent main. OpenClaw on this host uses agents.entries with a single senior-engineer agent; HUD hardcoded main.

Added an agent resolver for modern entries and legacy list configuration, plus HUD_AGENT_ID for explicit selection. Applied it to chat headers, HUD binding session keys, transcript paths and terminal intent requests. Existing tasks belonging to another agent are not reused. Chat displays the existing safe gatewayIssue field on failure.

Verification: 296 UI tests passed, production build passed. A real Chromium browser at the Ethernet URL submitted a one-line no-tools prompt using the GUI composer and session cookie. /api/chat returned HTTP 200, fromGateway=true, gatewayIssue=null, response=HUD_CHAT_OK. The rendered assistant message matched and no chat error appeared. Startup took tens of seconds. No device operation was requested. This acceptance covers a minimal chat turn, not every integration.

## Repeated-turn HTTP 500 investigation

The user's HTTP 500 was corroborated by gateway logs: repeated host-wide OOM kills and a lost Codex binding lease during startup. This VM had 15 GiB RAM, roughly 14 GiB used and no swap. Added a 4 GiB, root-owned mode-0600 /var/swap-netclaw; activated it and added a persistent /etc/fstab entry, with backup /etc/fstab.pre-netclaw-swap. fstab verification reported no errors. Other services were not stopped.

After restart and readiness, a browser's first turn succeeded but its second failed with MCP runtime cleanup could not confirm closure. The multivendor-cli MCP command points to a nonexistent per-server .venv/bin/python; the gateway logs explicitly reported ENOENT and cleanup identity lost. Backed up the private OpenClaw configuration and set only this server's enabled flag to false, preserving its definition. Restarted to clear the failed runtime. Other integrations with missing credentials remain unverified.

After disabling the missing multivendor runtime and waiting for gateway readiness, the same Chromium conversation completed two consecutive turns: HUD_CHAT_OK then HUD_SECOND_OK. Both /api/chat responses were HTTP 200 with fromGateway=true and gatewayIssue=null; both replies rendered, and neither showed a chat error. Kernel logs contain zero new OOM kills since swap activation/restart. This is repeated-turn acceptance, not an assertion that optional credentialed MCP integrations are configured.

## Long-running chat transport

On the rebooted, 32 GiB host, gateway logs showed the user's HUD request cancelled at 299974 ms with HTTP client disconnected. Both API abort and UI proxy previously used a 300000 ms deadline. The resulting connection race could leave the browser with a network/JSON error rather than the gateway status.

Added validated HUD_CHAT_TIMEOUT_MS (15 minutes by default), a proxy deadline 30 seconds longer, and a bounded node:http chat transport with an explicit total deadline independent of fetch's header timeout. Timed-out calls return a specific gatewayIssue; no automatic retries. Unit coverage includes delayed responses and stalled responses, and the real API fixture verifies a structured timeout with a shortened deadline. Initial full suite: 298 passed. Targeted transport/server tests: 3 passed. Original user request was not replayed. Logs show its HTTP run was cancelled; whether it completed any tool actions was not determined.

Live acceptance after API restart: session bootstrap and /api/chat through the Ethernet UI proxy returned HTTP 200, fromGateway=true, gatewayIssue=null and HUD_TRANSPORT_OK for a new no-tools probe. Production build passed. The original long-running user task was not repeated; extended-duration handling was verified with the delayed/stalled fixtures, not a 15-minute live model run.

## Combined PR packaging verification (2026-10-01)

Renumbered the unpublished interface spec to 140 to avoid upstream spec 134 (NetClaw Dot), then fast-forwarded onto upstream main. Specs 135–139 are included as coordinated chat workflow increments. No upstream historical specs were renamed.

- HUD unit/API suite: 322 passing; production build passed.
- Canvas terminal harness: passed (Canvas regressions, bundle budget, installer/parser Python mocks).
- Spec artifact validation: passed, 126 specs with four existing legacy exceptions.
- Reconciliation: catalog, dependencies, docs, Meraki IDs, packages and portability passed.
- Catalog coverage: zero unexplained gaps.
- Release metadata 1.4.0 and six release-helper tests passed. Version is a proposal for maintainer batch review; no tag or publication.
- No new paid inference or device operations. Existing browser/runtime evidence remains in specs 135–139. No alternate-provider, macOS or Windows live acceptance was performed.
- Local testbed changes and the backup archive are excluded from the PR.
