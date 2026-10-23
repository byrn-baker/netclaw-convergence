# Data model

Proposed application contracts; existing upstream shapes stay behind adapters.

| Entity | Required semantics |
|---|---|
| InstallationScope | Stable installation identity; role `standalone/border/member/unknown`; optional risk identity; configured features; declared visibility boundary |
| EntityRef | Stable source-qualified ID; class `local/member/edge/peer/advisor/device/integration`; display label; owner/scope. Labels are not keys |
| Observation | Source ID, scope, observed time (nullable), retrieved time, last-success time, status, safe reason, payload and source reference. Null is not zero |
| PresentationPreference | Basic/Advanced, selected view, filters and optional graph layout. Browser-local; no authority or credentials |
| CanvasSession/Node/Message | Existing IDs, content, tabs, branch/synthesis links, attachment references and layouts preserved. Optional assessment references added without replacing old fields |
| TrustedTaskBinding | Server-owned principal, authenticated session, originating task, message association and allowed assessment IDs; lifecycle/expiry and provenance. Client IDs are hints only |
| AssessmentRef | Opaque assessment ID plus server-verified binding reference; `bound/unbound/unavailable`. Imported references start unbound |
| AssessmentDetail | Exact question IDs/text; type-specific answer; model/provider; assessment/evidence times; evidence digest/references; usage/cost; task-budget scope; optional parent ID |
| BorderInfluence | Border-authored message/source reference, assessment ID, `supported/challenged/changed/unavailable`, explanation and authored time. Absent is `not recorded` in the UI |
| GraphRelation | Stable endpoints, relation kind, scope, source and observation/snapshot time. Physical, federation, advisory and simulated relations never merge |

## State rules

Observation availability: `loading/available/empty/not_configured/disabled/denied/unavailable`; freshness is separate (`fresh/stale/unknown`) so old valid data can remain visible alongside a refresh error. Preserve upstream detailed failure reasons through a safe allowlist.

Task access: authenticated request → trusted ownership lookup → exact assessment lookup → allowlisted response. Missing binding returns unbound. Revocation/expiry denies future reads and clears cached detail. A navigation/session change invalidates pending detail responses. No automatic reassignment from a global latest assessment.

Assessment lineage: original has no parent; at most one reconsideration references that original in the same originating task. Reject cross-task parents and cycles. Re-reading either record never invokes a provider.

Question types: Noul probability; Choice selected label and its returned confidence/distribution; Score rubric position/value and separately returned confidence/distribution. Retain labels/rubric and absent-field markers exactly; no manufactured probabilities, health normalization or confidence calibration claims.

## Persistence

Keep the existing canvas database name, storage origin and session format. New optional references must tolerate old readers/imports. Trusted ownership is held server-side with private file permissions, bounded retention and an explicit schema version; browser exports contain no credentials, access tokens or authority grants. Importing an ID never restores authorization. Cross-device canvas synchronization is out of scope.
