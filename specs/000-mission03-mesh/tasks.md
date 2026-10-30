# Tasks: Inter-instance BGP mesh

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Historical status

[MISSION03.md](MISSION03.md) is the original source. There is no new execution evidence in
this reconstruction, so qualification items remain unchecked.

## Follow-up verification

- [ ] V001 Inspect BGP speaker peer configuration and OPEN matching with isolated peer fixtures.
- [ ] V002 Check coexistence of local and remote peers, disconnect behavior and unexpected AS handling.
- [ ] V003 Perform tunnel and route propagation qualification only in an explicitly authorized network lab.

Completing these items requires a separate authorized execution record with actual
commands, environment and results; this artifact repair does not complete them.
