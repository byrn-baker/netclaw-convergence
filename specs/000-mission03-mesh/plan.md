# Plan: Inter-instance BGP mesh

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Reconstructed approach

The original scope is retained in [MISSION03.md](MISSION03.md); this plan records a
verification path without rewriting that historical mission.

1. Inspect BGP speaker peer configuration and OPEN matching with isolated peer fixtures.
2. Check coexistence of local and remote peers, disconnect behavior and unexpected AS handling.
3. Perform tunnel and route propagation qualification only in an explicitly authorized network lab.

## Boundaries

Use current catalog/tool declarations and isolated fixtures first. Keep external
credentials outside source. This repair changes documentation only; historical
sample commands and persona text are not new permission to operate services.

## Source anchors

- [mcp-servers/protocol-mcp/bgp/speaker.py](../../mcp-servers/protocol-mcp/bgp/speaker.py)
- [scripts/systemd/netclaw-mesh.service](../../scripts/systemd/netclaw-mesh.service)
