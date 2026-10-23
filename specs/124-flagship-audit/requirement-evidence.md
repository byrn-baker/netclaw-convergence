# Spec124 requirement evidence — bounded closeout

The explicit2026-09-27 scope amendment governs completion. This maps evidence and limitations, not exhaustive certification.

| Requirements | Disposition and evidence |
|---|---|
|FR-001–004|Complete baseline inventory in coverage.json;461 targeted,271 measured-execution,751 explicitly deferred. findings.md records001–103 and severity triage; deferred-review.md retains semantic and provider gaps.|
|FR-005,FR-013|Confirmed repairs001–103 have exact tasks and analysis; final mobile/native gates passed as recorded in verification.md.|
|FR-006|Lossless GCF benchmark and bounded receiver/dispatch tests retained; no broad performance claim.|
|FR-007–009|Migration contract and docs/AUDIT124-MIGRATIONS.md; isolated preview/apply/repeat/failure/recovery tests; Docker Debian/systemd and WSL fresh/upgrade preserve fixture hashes. Actual operator adoption completed after main; operator-adoption.json records preservation and health.|
|FR-010|All six reconciliation surfaces pass;227 HUD tests/build and434 Flutter tests/clean analysis at final local checkpoint. Editorial README rewrite remains a later phase.|
|FR-011–012|Explicit scope amendment in spec/plan/analysis/tasks; deferred backlog, local unpublished blog and handoff; GAIT audit124-wsl-completion-2026-09-27 and private daily log. Spec artifact gate passes.|
|FR-014|Historical Mac runtime/native CI, Docker Debian real systemd and isolated WSL evidence retained. Docker shares WSL kernel; no bare-metal boot/wiped-Mac or new physical phone/watch claim.|

Compatibility and recovery are detailed in [the migration contract](contracts/audit-and-migration.md) and [migration guide](../../docs/AUDIT124-MIGRATIONS.md). Existing stored schemas are preserved except deliberately rejected unsafe inputs/configuration. No credential, testbed or knowledge purge is part of adoption. Private originals and conflict-detecting journals govern recovery; historical data already lost cannot be reconstructed without a retained backup.
