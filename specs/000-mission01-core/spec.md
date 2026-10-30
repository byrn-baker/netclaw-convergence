# Specification: Core network coworker

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Historical scope

The original mission describes an operator using MCP-backed pyATS skills to gather
structured network state, troubleshoot, assess health/security and document work.
Configuration changes follow baseline, plan, apply and verification steps. The
historical CCIE persona is narrative framing, not a certification claim or authority.

## Reconstructed requirements

- R1: Observe actual device state before diagnosing or proposing a change.
- R2: Keep configuration changes within an authorized workflow with a recorded baseline and rollback.
- R3: Present tool-derived observations separately from interpretation and unavailable evidence.

## Acceptance still requiring qualification

- Trace an observation-only request through the pyATS skill and its declared MCP tools.
- Use an isolated device fixture to check baseline/change/verification ordering before any authorized live qualification.
- Confirm health/security reports identify unavailable devices instead of inventing observations.

## Evidence

- [specs/000-mission01-core/MISSION01.md](../../specs/000-mission01-core/MISSION01.md)
- [workspace/skills/pyats-network/SKILL.md](../../workspace/skills/pyats-network/SKILL.md)
- [workspace/skills/pyats-config-mgmt/SKILL.md](../../workspace/skills/pyats-config-mgmt/SKILL.md)
- [workspace/skills/pyats-health-check/SKILL.md](../../workspace/skills/pyats-health-check/SKILL.md)

These criteria organize the historical mission for future verification; none were
executed as part of this documentation repair.
