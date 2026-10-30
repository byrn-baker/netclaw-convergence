# Verification — spec159 / issue302

2026-10-29. Source fixtures on macOS, Node24.19.0 and isolated Python/httpx.

- Regression reproduced before implementation: four lost admissions exhaust the
  limit; no explicit release path exists. New bridge regression failed first.
- All HUD unit tests passed: **383/383**, zero skips/failures, including actual
  React recovery and all Specs157/158 regressions. Production build passed;
  existing >500kB chunk advisory remains.
- Hermes Python suite: **24 passed / 30**, six explicit real-Hermes interpreter
  opt-in skips. Ledger and bridge tests use actual private SQLite plus controlled
  HTTP transport; no provider/device invocation.
- Four lost admissions, ordinary acknowledgment, restart and explicit review:
  exactly five native run POSTs (four originals and one newly authorized turn),
  no duplicate old nonce, old conversation still blocked, unknown audit retained.
- Concurrent release is idempotent; malformed intent, missing/foreign identity,
  active/terminal/known run/execution scope/federation are rejected. Transaction
  failure rolls back release; session setup failure retains honest audit and is
  retryable. A late native ID makes the reservation count again.
- Owned history can recover request identity after tab storage loss without
  reconstructing its prompt. Cancel performs no POST; default acknowledgment
  carries no release flag; confirmed release carries exact owned ID and true.
  Ownership is checked before/after private I/O. Native concurrency is unchanged.
- SDD analysis: all6FRs/3SCs covered by7tasks; checklist5/5; zero unresolved
  findings. No new MCP tool/component/environment/dependency or live qualification.

Recovery is an explicitly reviewed admission-accounting action, not proof that
an operation stopped. Existing source/runtime/provider/platform limits remain.
