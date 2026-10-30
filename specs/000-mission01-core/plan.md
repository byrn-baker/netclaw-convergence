# Plan: Core network coworker

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Reconstructed approach

The original scope is retained in [MISSION01.md](MISSION01.md); this plan records a
verification path without rewriting that historical mission.

1. Trace an observation-only request through the pyATS skill and its declared MCP tools.
2. Use an isolated device fixture to check baseline/change/verification ordering before any authorized live qualification.
3. Confirm health/security reports identify unavailable devices instead of inventing observations.

## Boundaries

Use current catalog/tool declarations and isolated fixtures first. Keep external
credentials outside source. This repair changes documentation only; historical
sample commands and persona text are not new permission to operate services.

## Source anchors

- [workspace/skills/pyats-network/SKILL.md](../../workspace/skills/pyats-network/SKILL.md)
- [workspace/skills/pyats-config-mgmt/SKILL.md](../../workspace/skills/pyats-config-mgmt/SKILL.md)
- [workspace/skills/pyats-health-check/SKILL.md](../../workspace/skills/pyats-health-check/SKILL.md)
