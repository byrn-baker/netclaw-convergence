# MCP boundary contract

Upstream is fixed to https://mcp.equinix.com/fabric. Local transport is newline JSON-RPC
stdio. mcp-remote@0.14.3 supplies HTTP/OAuth. No caller-controlled endpoint or command.

- initialize advertises tools only; no upstream sampling/roots/elicitation access.
- tools/list preserves pagination and schemas, filters exact catalog, and adds
  required `_netclaw` gate metadata to writes only when explicitly enabled.
- tools/call requires prior discovery, denies unknown/delete names, strips local
  metadata before dispatch. No arbitrary HTTP passthrough exists.
- netclaw_prepare_change is local, non-mutating; returns an exact approval marker.
- Successful reads produce a session-scoped baseline with timestamp and response
  digest; actual response/arguments snapshot is private on disk. Sensitive service
  token reads do not create baseline snapshots.
- Write gate order: enabled → known tool → fresh unused baseline → exact approved
  Implement CR and operation marker → CR plans/CI → primary-CI incidents → GAIT.
- Baseline consumed before forwarding; no automatic retries. Upstream errors pass
  through unchanged. Results require separate read-back; CR closure is never automatic.
- New tool names, unsupported methods and invalid messages fail closed. Lists that
  change invalidate discovery. EOF tears down the bridge process group on POSIX.

Tests use synthetic manifests/ServiceNow and fake stdio upstream. This contract
is implemented locally; live upstream compatibility remains account-owner acceptance.
