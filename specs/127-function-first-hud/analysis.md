# Specification analysis

## Traceability

| Requirements | Stories | Tasks | Release evidence |
|---|---|---|---|
| FR-001/014 | US1 | T003/007/013/021 | Old-session browser round trip; full canvas behavior; recovery |
| FR-002/003 | US1/2/3 | T006–008 | Mode/navigation/draft/request journeys |
| FR-004/005/006 | US2/5 | T002/005/008/014 | Deployment matrix, identity/count/failure fixtures |
| FR-007/008 | US4 | T009–013 | Typed semantic and authorization tests; original/reconsideration |
| FR-009/013/015 | US1/3/4/5/6 | T009–011/014/016/017/021 | Gate parity, no-inference reads, no cross-session disclosure |
| FR-010 | US6 | T002/006/015–017 | Producer and navigation coverage matrix |
| FR-011/012 | US7 | T018–020 | Browser accessibility, fallback and performance evidence |

## Findings

- No conflict between preserving the canvas and a panel-first dashboard: canvas remains a full independent workspace; new panels exchange explicit selected evidence and authorized references.
- Basic/Advanced is presentation, not an authorization tier. Advisor versus member and peer versus internal identities remain separate everywhere.
- Detailed Jev views are not achievable by extending the global status object alone. Trusted gateway/task binding and isolation of shared history/broadcast paths are hard prerequisites.
- “All dashboard things NetClaw” is concretized by a workflow inventory and searchable capability catalogue, with truthful gaps where a structured producer does not exist. It does not claim every MCP is a live dashboard feed.
- Existing source review supports the plan; performance and host acceptance remain unmeasured targets.
- The user ratified the spec on 2026-09-28. Runtime implementation exists locally; automated checks and remaining browser/live-host gates are tracked separately. It is not represented as fully accepted or shipped.
