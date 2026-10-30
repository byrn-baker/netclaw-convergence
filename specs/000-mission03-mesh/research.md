# Research: Inter-instance BGP mesh

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Evidence reviewed

- [specs/000-mission03-mesh/MISSION03.md](../../specs/000-mission03-mesh/MISSION03.md)
- [mcp-servers/protocol-mcp/bgp/speaker.py](../../mcp-servers/protocol-mcp/bgp/speaker.py)
- [scripts/systemd/netclaw-mesh.service](../../scripts/systemd/netclaw-mesh.service)

## Interpretation and limits

The third mission describes remote NetClaw BGP peers reached through TCP tunnels,
with peer identity derived from the BGP OPEN AS rather than only an incoming IP.
It preserves local peering while allowing remote route exchange. Public tunnels
and routing changes require their own operational scope; this record creates none.

The mission establishes intended behavior. The current paths provide traceable
implementation or workflow anchors, but neither file presence nor mission prose
proves a successful live deployment. Current component ownership and permissions
must be rechecked before reviving historical operational instructions.
