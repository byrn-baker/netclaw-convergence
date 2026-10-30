# Specification: pfSense MCP integration

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Source and scope

[requirements.md](requirements.md) is the original detailed requirements document;
it remains authoritative for authentication, firewall/NAT/interface management,
DNS/DHCP, logs, diagnostics, gateways, services, backups and response formatting.
The intended user is an operator accessing pfSense through a stdio MCP integration.

## Key acceptance boundaries

- Credentials come from environment configuration; errors exclude credential values.
- TLS verification defaults on; transport failures are bounded and actionable.
- Writes validate inputs, preserve management access, apply when required and return
  the resulting state under the applicable change authorization.
- Log/state queries remain bounded; unavailable targets are explicit failures.

## Status and evidence

[design.md](design.md) selects the REST API v2 client and shared formatter; the
existing [tasks.md](tasks.md) is an unchecked implementation plan. The proposed
`mcp-servers/pfsense-mcp/` package is absent from this checked-out source. A current
catalog reference does not establish that this historical implementation was shipped.
No pfSense appliance or external repository was contacted for this reconstruction.
