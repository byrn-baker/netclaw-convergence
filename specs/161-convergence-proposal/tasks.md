# Tasks: focused Convergence proposal

## Scope proposal

- [x] T001 Inspect upstream contribution policy, source and existing observability integrations.
- [x] T002 Compare Grafana/Prometheus/IPFIX/HUD capabilities with retained Convergence flow evidence.
- [x] T003 Recommend external service ownership and one read-only observation-to-records workflow.
- [x] T004 Document concrete proposed files/dependencies, acceptance and platform limits; preserve provenance.
- [ ] T005 Obtain maintainer agreement on this bounded flow-evidence integration.

## Implementation only after agreement

- [ ] T006 Coordinate the implementation spec, pinned external revision, tool/response/error contracts and notices.
- [ ] T007 Implement the optional two-tool connector with auth, scope, bounds and negative contract tests.
- [ ] T008 Add isolated installation/registration, read-only operator skill and connection documentation.
- [ ] T009 Adapt the upstream HUD route/view and prove same-window evidence, ownership and unavailable-source behavior.
- [ ] T010 Run actual connector-to-HUD acceptance, lifecycle and supported-platform checks; record gaps honestly.
- [ ] T011 Complete independent review, coherence checks and implementation release metadata.

T005 gates T006–T011. No case/server/storage/chart/IDS/automated-investigation port
is implied or approved by this milestone. Fork maintenance and acceptance work may
continue independently, but cannot mark upstream implementation tasks complete.
