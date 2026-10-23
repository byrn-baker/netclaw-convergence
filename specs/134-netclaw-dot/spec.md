# Feature Specification: NetClaw Dot integration

**Resumed 2026-09-30:** Dots now available on the owner account. MVP server built; real-Dot acceptance (T010) and repository coherence (T011) still open.

**Feature Branch:** `134-netclaw-dot`  
**Created:** 2026-09-29  
**Status:** Implemented (experimental) — see verification.md  
**Input:** Owner requests Dot feasibility, a branch, SDD, a Sonnet takeover guide and operator usage.

## User Scenarios & Testing

### US1 — Safe capability discovery (P1)
An operator connects a NetClaw capability to their actual Dot and can tell what runs where.
Independent test: synthetic inventory returns a timestamped fixture report in the Dot.
Given no supported connection or account access, connection reports unavailable; it never claims an active Dot. Given an authenticated synthetic session, discovery exposes only the three approved read tools.

### US2 — Evidence-based triage (P1)
An operator requests health for authorized aliases and receives bounded, timestamped findings.
Independent test: fixture health, stale evidence and timeout each produce distinct outcomes.
Given no approved non-sensitive output policy, live backend calls are disabled. Given private data in an adapter response or error, it never reaches hosted output. Given a write request, no write backend is invoked.

### US3 — Repeatable setup and revocation (P2)
An operator installs the package on a proven surface, inspects local audit and revokes access.
Independent test: a second session reproduces setup, and revoked credentials cannot invoke tools.
Given desktop-only installation, documentation does not claim background/mobile capability. Given a production or Local/Lab configuration request, MVP refuses and refers to the existing local workflow.

### Edge cases
Desktop offline; expired authentication; tool unavailable; empty inventory versus backend failure; changed alias mapping; stale timestamp; redaction failure; prompt injection inside device data; audit disk full; mixed scopes; partial fleet timeout; duplicate request after reconnect.

## Requirements

- FR001: Establish real Dot account/host support before claiming integration acceptance.
- FR002: Code-enforced allowlist of three read tools; no arbitrary command or backend dispatch.
- FR003: Authenticate caller and bind authorization to allowed aliases on every invocation; no caller-provided tenant privilege.
- FR004: Private configs, credentials, addressing and topology remain local. Default synthetic mode; explicit classified output schema for operational use. No raw errors or unrestricted evidence downloads.
- FR005: Return provenance, UTC observation time and distinct unavailable/stale/partial/error outcomes. No guessed device state or computed misleading health percentage.
- FR006: Durable local per-request audit, GAIT session lifecycle and bounded time/size/device limits. Audit unavailable means refuse execution.
- FR007: Preserve platform write ownership, production ServiceNow workflow and narrowly scoped Terminal Intent Local/Lab exception. This adapter grants no writes or lab designation.
- FR008: Disconnection and revocation prevent subsequent calls. Preserve local audit for review.
- FR009: Document actual installation paths per verified surface and limits of always-on operation.
- FR010: Test authorization, redaction, injection, timeout, audit and write-denial boundaries with synthetic fixtures.

## Key Entities
ConnectionProfile, ReadRequest, Observation and AuditRecord; see [data-model.md](data-model.md).

## Success Criteria
SC001: One actual Dot fixture request succeeds with recorded host and source evidence.
SC002: All three tools satisfy contract tests; all negative security cases refuse or redact correctly.
SC003: No secrets/private topology escape in success, error, logging or artifact paths.
SC004: Operator independently follows quickstart and revocation; all claimed surfaces are demonstrated.
SC005: Existing runtime behavior is unchanged; required repository coherence checks pass at implementation time.

## Assumptions and Dependencies
Dot rollout/admin enablement and supported integration surface are external gates. Existing NetClaw remains local and functional independently. This planning session does not authorize live network changes, external communications or cloud disclosure of private network data.
