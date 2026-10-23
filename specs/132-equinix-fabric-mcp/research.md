# Research — verified 2026-09-29

## Primary sources and decisions

- [Announcement, September 24](https://community.equinix.com/network-edge-11/what-s-new-fabric-mcp-server-adds-network-edge-search-and-visibility-tools-1222): Network Edge visibility added to the existing Fabric service. Tracking-query URL failed; canonical URL worked.
- [Network Edge tools](https://docs.equinix.com/equinix-api/mcp-servers/ne-mcp-tools/): seven documented names: list_devices, list_metros, list_device_types, list_accounts, list_acls, list_aclTemplates, list_project. Shared names across product tables require live schema discovery; do not fabricate namespaces.
- [Fabric tools](https://docs.equinix.com/equinix-api/mcp-servers/fabric-mcp-server/): connections, ports, routers, routes, routing protocols, networks, filters, service profiles and telemetry. Viewer-labelled refresh_routes creates a route action: exclude it. Also exclude service-token searches because this feature needs inventory, not access material. Documented list_projects has a malformed permission row; exclude until reviewed. Tools named create_router_command and create_routing_protocol_action run active diagnostics/reset and are excluded.
- [Authentication/security](https://docs.equinix.com/equinix-api/mcp-servers/overview/): public preview; browser OAuth and account-role/consent intersection. Select fabricViewer. Tokens expire; DCR can require another browser login. Some creations are billable; no delete tools. Account access and project entitlement still apply. Client removal does not revoke consent; use AI Consent Management. Equinix audits API calls, separately from NetClaw GAIT.
- [OAuth bridge source](https://github.com/punkpeye/mcp-remote): stdio to remote HTTP, browser auth and MCP_REMOTE_CONFIG_DIR. npm registry returned 0.14.3. Pin this version; do not auto-upgrade the bridge. NetClaw adds an exact allowlist rather than a mutation-prefix denylist, so future names fail closed.
- [Equinix Labs alternative](https://github.com/equinix-labs/equinix-docs-mcp-server): experimental generated API/docs server. Not the announced hosted service; not installed. Avoid expanding into arbitrary generated write APIs.

## Repository findings

Read AGENTS.md, SOUL.md, USER.md, TOOLS.md, constitution and docs/ADDING-AN-MCP.md.
Clean worktree at start; source 1.1.0. Installer is shared Bash catalog + setup, no
tracked setup.exe/Windows packaging recipe. A local stdio policy bridge merits a
config entry; do not double count as EXTERNAL_INTEGRATIONS. HUD uses server.js
catalog and configuration maps, plus generated docs/reference/interfaces.json.
iN2N uses PROFILE_MATCHERS, ENV_PREFIXES and MCP_SERVERS in in2n-profiles.py.

GAIT branch succeeded through scripts/mcp-call.py. pyats_list_devices failed:
PYATS_TESTBED_PATH missing. MemPalace callable tools unavailable in this session.
No daily file existed at startup. No live Equinix credentials examined or used.

## Open evidence gaps

Actual manifest, pagination schemas, duplicate product tool names, tenant scope,
OAuth/bridge interoperability and token renewal require operator live acceptance.
Do not describe these as tested. No authenticated data or screenshots in blog.

## Owner scope update

Owner explicitly requested full operations beyond reads. Revised FR-003/009: expose
all documented non-delete mutations behind exact-operation ServiceNow approval,
including route actions. Original read-only plan is superseded. Service-token
operations remain sensitive: returned secrets must not enter audit/blog/UI exports.
Latest AGENTS Local/Lab exception applies only to Terminal Intent, never this MCP.
