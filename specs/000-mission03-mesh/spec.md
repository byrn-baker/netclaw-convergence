# Specification: Inter-instance BGP mesh

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Historical scope

The third mission describes remote NetClaw BGP peers reached through TCP tunnels,
with peer identity derived from the BGP OPEN AS rather than only an incoming IP.
It preserves local peering while allowing remote route exchange. Public tunnels
and routing changes require their own operational scope; this record creates none.

## Reconstructed requirements

- R1: Preserve configured local peers while adding explicit remote-peer identity and transport.
- R2: Associate accepted remote sessions with configured AS/peer policy; do not equate an arbitrary source address with a trusted peer.
- R3: Report session state and advertised/received routes without silently exposing a listener.

## Acceptance still requiring qualification

- Inspect BGP speaker peer configuration and OPEN matching with isolated peer fixtures.
- Check coexistence of local and remote peers, disconnect behavior and unexpected AS handling.
- Perform tunnel and route propagation qualification only in an explicitly authorized network lab.

## Evidence

- [specs/000-mission03-mesh/MISSION03.md](../../specs/000-mission03-mesh/MISSION03.md)
- [mcp-servers/protocol-mcp/bgp/speaker.py](../../mcp-servers/protocol-mcp/bgp/speaker.py)
- [scripts/systemd/netclaw-mesh.service](../../scripts/systemd/netclaw-mesh.service)

These criteria organize the historical mission for future verification; none were
executed as part of this documentation repair.
