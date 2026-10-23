# Data model

Baseline: UUID, observed read tool, argument/response SHA-256, epoch retrieval time,
private artifact path and in-memory consumed flag. Lifetime: one process / one hour.
Approval digest: canonical JSON SHA-256 over endpoint, write tool, upstream arguments
and baseline. Approved externally as a marker in ServiceNow implementation_plan.
CR verifier: exact number, approved, Implement, primary CI sys_id, rollback/test/risk/
impact; blocks active P1/P2 incidents for that CI. No ticket creation or updates here.
OAuth cache: private runtime base + hash partition of N2N_MEMBER_ID, or standalone.
HUD: static integration/configuration metadata only; no OAuth contents/live fake data.
Audit: tool, phase, CR/digest/baseline identifiers and success; never raw payloads.
