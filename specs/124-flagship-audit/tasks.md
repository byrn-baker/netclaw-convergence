# Tasks: NetClaw Flagship Audit

## Phase 1 — Setup

- [x] T001 Capture user clarification, scope and platform matrix in specs/124-flagship-audit/spec.md and clarification.md (FR-014).
- [x] T002 Establish GAIT session and persisted intake in specs/124-flagship-audit/handoff.md and memory/2026-09-26.md (FR-011).
- [x] T003 Enumerate tracked files and ownership/review status in specs/124-flagship-audit/coverage.json; capture host/tool availability in verification.md (FR-001, FR-014).

## Phase 2 — Foundation

- [x] T004 Inspect tests/contract-suites.json and its harnesses for side effects, then record reconciliation and contract baseline under specs/124-flagship-audit/evidence/ (FR-001, FR-008).
- [x] T005 Create finding ledger and trust-boundary review map in specs/124-flagship-audit/findings.md (FR-002, FR-003).
- [x] T006 Correct stale canonical spec path with a documented PATCH amendment in .specify/memory/constitution.md; preserve all policy principles (FR-010, FR-012).

## Phase 3 — US1: Evidence and security repair

Independent test: coverage inventory has every baseline tracked path and every confirmed finding has reproduction, impact and evidence.

- [x] T007 [US1] Review install/CLI/dependency/CI boundaries in scripts/, config/, .github/workflows/, .env.example and dependency manifests; record findings in specs/124-flagship-audit/findings.md (FR-003, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T008 [US1] Review HTTP/WebSocket/auth/upload/process boundaries in ui/netclaw-visual/server.js and ui/netclaw-visual/src/; reproduce confirmed defects in targeted tests (FR-003, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T009 [US1] Review peer identity, authorization, grants, execution and audit paths in mcp-servers/protocol-mcp/bgp/federation/ and mcp-servers/n2n-mcp/; record evidence (FR-003, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T010 [US1] Review ingestion/retrieval/replication, persistence, GCF correctness and resource limits in mcp-servers/rag-mcp/, mcp-servers/memory-mcp/ and src/netclaw_tokens/ (FR-003, FR-004).
- [x] T011 [US1] Review remaining MCP servers and workspace/skills/ against actual tool schemas, read/write enforcement and transport/dependency behavior; record per-server coverage in coverage.json (FR-003, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T012 [US1] Review mobile enrollment, approvals, capture, watch relay, voice and Zoom boundaries in mobile/netclaw-mobile/, mcp-servers/twilio-voice-mcp/ and mcp-servers/protocol-mcp/bgp/federation/zoom_channel.py (FR-003, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T013 [US1] Review docs/, specs/, examples/, lab/, labs/, captures/, benchmarks/, root operating files and asset/generated boundaries; complete coverage dispositions in coverage.json (FR-001, FR-004). **Bounded disposition:** targeted evidence retained; remaining review explicitly deferred in deferred-review.md by user direction, not passed.
- [x] T014 [US1] Add finding-specific remediation tasks with exact source/test paths to this tasks.md and rerun cross-artifact analysis before each repair batch; implement and verify all confirmed defects, retaining blockers in findings.md (FR-005, FR-013).

## Phase 4 — US2: Trustworthy normal/failure behavior

Independent test: audited entry points preserve authorization and distinguish failures, empty/partial/stale data, with negative-case evidence.

- [x] T015 [US2] Resolve offline suite failures and dependency gaps in tests/contract-suites.json and owning source/test paths; record exact outcomes in verification.md (FR-005, FR-008).
- [x] T016 [US2] Run HUD Node tests/build and mobile available checks from ui/netclaw-visual/package.json and mobile/netclaw-mobile/; document platform gaps (FR-004, FR-014).
- [x] T017 [US2] Measure identified performance bottlenecks with reproducible fixtures under benchmarks/ and evidence/; implement only supported improvements (FR-006).
- [x] T018 [US2] Create concrete lab/platform requests and acceptance procedures in specs/124-flagship-audit/verification.md, execute available lab checks and retain unavailable checks as blockers (FR-008, FR-014).

## Phase 5 — US3: Safe adoption

Independent test: every breaking change has verified preview/apply/repeat/failure/recovery scenarios against preserved old-state fixtures.

- [x] T019 [US3] Classify each repair as compatible or breaking in findings.md; for breaking changes extend contracts/audit-and-migration.md with exact CLI/state behavior and add source/test tasks before implementation (FR-007).
- [x] T020 [US3] Implement and verify all required finding-specific migration scripts under scripts/ and corresponding tests/; record backup, state-preservation and recovery evidence in verification.md (FR-007).
- [x] T021 [US3] Exercise isolated install/upgrade smoke tests for required platforms using scripts/install.sh and scripts/lib/; only if host replacement is needed, preserve/verify local state and restore a working installation (FR-009, FR-014).

## Phase 6 — US4: Coherence and handoff

Independent test: another session can resume from handoff without conversation history; each requirement links to tasks and evidence.

- [x] T022 [US4] Repair GAIT skill/server contract drift in workspace/skills/gait-session-tracking/SKILL.md and affected callers after finding-specific task review (FR-010, FR-011).
- [x] T023 [US4] Update changed capability documentation/registration/installer/skills/HUD artifacts, including README.md, SOUL.md, TOOLS.md where applicable, and run coherence gates (FR-010).
- [x] T024 [US4] Review source and rendered Markdown for changed user guidance and fix broken links/formatting; record evidence in verification.md (FR-010).
- [x] T025 [US4] Maintain specs/124-flagship-audit/analysis.md and requirement→task→evidence mapping through repair batches; close all analysis findings (FR-012).

## Final phase — Completion

- [x] T026 Re-run required checks after final fixes and complete severity-sorted audit report in specs/124-flagship-audit/findings.md, with every gap visible (FR-001–FR-014).
- [x] T027 Write local milestone blog draft in specs/124-flagship-audit/blog-draft.md, final handoff.md, daily log and GAIT summary; provide next phase entry point before /clear (FR-011).

## Dependencies and execution

T001–T003 precede T004–T006. Review work T007–T013 can be interleaved once the evidence ledger exists. Repair task additions (T014) depend on confirmed findings and an analysis pass; exact repairs are never an unspecified license to rewrite unrelated code. US2 follows the corresponding reviewed subsystem; US3 follows breaking-change classification, and may be not-applicable only with an explicit no-breaking-change inventory. US4 follows each repair batch and concludes after verification. T026–T027 require completion of all applicable earlier tasks.

## Parallel opportunities

- [x] T113 [US1] Reproduce/fix A124-073 HUD skill/session identifiers escaping their intended directories in server.js; add resolved-path containment in src/security/resource-path.js and real HTTP traversal/symlink regressions in server-access.test.js.
- [x] T114 [US2] Reproduce/fix A124-074 HUD budget display disagreeing with enforced zero/invalid limits; extract validated policy resolution, preserve zero ceilings and report halted at zero with real endpoint and resolver regressions.

- [x] T111 [US4] Fix A124-071 obsolete nested-input GAIT examples across workspace/skills (exact paths in evidence/wsl/gait-skill-corrections.json); validate literal calls against actual gait_record_turn schema, preserve example text and distinguish illustrative results from observations.
- [x] T112 [US1] Fix A124-072 aci-change-deploy/SKILL.md approval gate permitting approved OR Implement; require exact intended CR, approved status AND Implement state, verified baseline and observed post-change results; review changed guide and retain external tool-schema caveat.

- [x] T110 [US2] Reproduce/fix A124-070 mobile headless reconnect leaking a client that finishes after the caller times out in lib/ncfed/headless_connect.dart; verify late completion closes once and ordinary success remains open in test/headless_connect_test.dart, then run Flutter tests/analyze serially.

- [x] T109 [US3] Extend A124-067/A124-061 repair to component_install_n2n in scripts/lib/install-steps.sh: use runtime-aware private literal defaults/updates and propagate failed required dependencies; test actual component without network calls in tests/unit/test_n2n_install_preservation.py.

- [x] T108 [US1] Fix A124-069 expired federation approvals being recorded as approved before polling; enforce expiry during resolve/list in authorization.py, expose refusals in service.py/bgp-daemon-v2.py and test actual SQLite expiry and unchanged live approval behavior.

- [x] T107 [US1] Fix A124-068 federation service role-read failure opening external peering in service.py; fail closed for unavailable/unknown roles and test incoming/outgoing admission before network I/O in tests/n2n/test_en2n_regression.py.

- [x] T106 [US3] Repair A124-067 scripts/netclaw role persistence corrupting literal values and reading quoted values incorrectly; extend scripts/write-env.py with explicit systemd encoding, use atomic writes/decoded reads and test real shell functions plus systemd acceptance.

- [x] T104 [US1] Repair A124-065 non-finite/invalid budget configuration in src/netclaw_tokens/budget_policy.py, preserve last valid layered limits, parse boolean values deliberately and verify tests/test_budget_policy.py negative cases.
- [x] T105 [US1] Repair A124-066 memory semantic filtering and false-success errors in mcp-servers/memory-mcp/storage/chroma_store.py; test real persistent Chroma date/topic filters and backend/embedder failure, document bounded candidate retrieval and preserve existing stored metadata.

- [x] T095 [US3] Reproduce and repair A124-056 deployment overriding the literal dotenv writer in scripts/lib/install-steps.sh; exercise actual core_deploy with metacharacter paths and pre-existing assignments in tests/unit/test_core_deploy_preservation.py.
- [x] T096 [US3] Reproduce and repair A124-057 workspace deployment overwriting operator persona files and testbed; preserve existing files/links and custom data-directory settings, test fresh/repeat deployment, and document upgrade behavior in docs/AUDIT124-MIGRATIONS.md.
- [x] T097 [US1] Reproduce and repair A124-058 explicit plaintext enable secrets leaking through mcp-servers/rag-mcp/scrubber.py; verify type-0, privilege-level and multiword values in tests/unit/test_rag_scrubber.py; document existing snapshot review.
- [x] T098 [US2] Fix A124-059 tests/redfish/run-tests.sh mistaking an unrelated HTTP 404 service for its fixture; require successful HTTP response, support isolated REDFISH_TEST_URL, verify absent/wrong-service and digest-pinned mock cases.
- [x] T099 [US1] Reproduce and fix A124-060 Chroma count failures reported as an empty RAG corpus in storage/chroma_store.py and rag_mcp_server.py; test actual store-to-search error propagation in tests/unit/test_rag_ingest_guards.py.
- [x] T100 [US2] Reproduce/fix A124-061 installer success exit after component or required token dependency failure in scripts/install.sh and scripts/lib/install-steps.sh; add isolated CLI regressions in tests/unit/test_installer_exit_status.py and retain all failure details.
- [x] T101 [US1] Reproduce/fix A124-062 RAG replica promotion deleting stable data before staging rename; retain rollback collection, restore on rename failure and test real Chroma state in tests/unit/test_rag_replica_promotion.py. Document interrupted promotion recovery limits.
- [x] T102 [US1] Reproduce/fix A124-063 RAG Office expansion/page caps bypass in ingestion/parsers.py; add compressed-archive and Office page-count regressions in tests/unit/test_rag_parser_limits.py and document input-limit semantics.
- [x] T103 [US3] Fix A124-064 pyATS in-place runtime replacement after reproduced package failure breaks the old interpreter: add scripts/setup-pyats-runtime.py staged source/venv generations, preview/repeat/restore/failure tests in tests/unit/test_pyats_runtime_recovery.py; wire installer, bridge and migrate-pyats-http.py to the managed source path and document recovery.

Independent read-only scans or separate isolated suites can run concurrently; shared-file edits remain sequential. Examples: US1 installer versus RAG review; US2 token-budget versus HUD tests; US3 migrations against separate temporary fixtures; US4 link checking versus count reconciliation. No sub-agents are requested or spawned.

## Implementation strategy

Start with a complete inventory and honest baseline, then close high-impact reproducible defects in bounded batches. Keep the repository usable between batches. Do not declare audit completion while confirmed defects or required acceptance checks remain unresolved. New findings receive numbered tasks and analysis before implementation.

## Repair batch 1 — discovery additions (execute before final phase)

- [x] T028 [US1] Reproduce A124-001 with synthetic isolated-home HTTP/WebSocket fixtures; add regression tests in ui/netclaw-visual/src/security/local-access.test.js and server integration test (FR-003, FR-005).
- [x] T029 [US1] Implement A124-001 loopback/Host/Origin protection in ui/netclaw-visual/src/security/local-access.js, server.js, vite.config.js and package.json; preserve local canvas/chat endpoints (FR-003, FR-005).
- [x] T030 [US3] Add SSH-tunnel migration CLI scripts/migrate-hud-access.py, tests/unit/test_hud_access_migration.py and docs/HUD-ACCESS.md, with preview, validated ports/target, no secret/state writes and clean tunnel shutdown; update README.md/.env.example (FR-007, FR-010).
- [x] T031 [US2] Repair A124-002 manifest dependency in tests/contract-suites.json and validate tests/test_gcf_serializer.py with pinned GCF (FR-005).
- [x] T032 [US2] Reproduce and repair A124-003 field loss in src/netclaw_tokens/gcf_serializer.py with lossless/changed-attribute regressions in tests/test_gcf_serializer.py; document correctness tradeoffs (FR-005, FR-006).
- [x] T033 [US4] Investigate A124-004 counts and A124-005 tracked-versus-installed dependency scanning in scripts/verify-inventory-counts.py, scripts/check-dependency-pins.py and scripts/lib/install-steps.sh; add precise tasks for confirmed root causes (FR-002, FR-010).
- [x] T034 [US4] Correct A124-006 schemas, checkout and side-effect guidance in workspace/skills/gait-session-tracking/SKILL.md against fetched server provenance and validate calls (FR-010, FR-011).

Batch dependencies: T028 → T029 → T030 security verification; T031 precedes T032. T033 is investigation only until root cause is established. T034 may follow independently. These extend T014/T019/T022 and must close before T026.

- [x] T035 [US1] Repair A124-007 in ui/netclaw-visual/package.json and package-lock.json with patched compatible dependency versions, remove unused cors, rerun npm audit, Node tests and build, and document npm ci adoption (FR-003, FR-005, FR-010).

- [x] T036 [US2] Repair A124-008 manifest imports and add validated per-file pytest isolation to scripts/run-contract-tests.py/tests/contract-suites.json with collision and failure aggregation regressions in tests/runner/test_run_contract_tests.py (FR-005, FR-008).
- [x] T037 [US2] Repair A124-009 in tests/n2n/test_delegation_bypass_guard.py and test_log_dampening_config_100.py; test actual RPC timeout behavior and add precise production repair if reproduced (FR-005, FR-014).
- [x] T038 [US2] Investigate A124-010 Flutter generated-state contention, run mobile tests and analyze serially from mobile/netclaw-mobile/; preserve generated state if isolation is needed (FR-004, FR-014).

- [x] T039 [US2] Fix A124-011 response-deadline ownership and pending-call cleanup in mcp-servers/protocol-mcp/bgp/federation/gateway.py and gateway_ws.py; verify delayed response, timeout, cancellation and send failure in tests/n2n/test_delegation_bypass_guard.py and test_gateway_rpc_cleanup.py (FR-005).

- [x] T040 [US4] Remove reverted Astra Live Twin capability claims and reconcile 172 integration counts in README.md/SOUL.md; verify against config/catalog and scripts/verify-inventory-counts.py (A124-004, FR-010).
- [x] T041 [US2] Add HUD Node test/build CI in .github/workflows/hud-ci.yml and enable the verified n2n suite in tests/contract-suites.json; validate manifest matrix and workflow syntax (FR-008).

- [x] T042 [US2] Repair A124-012 in mcp-servers/zabbix-mcp/requirements.txt, tests/zabbix/test_venv_isolation.py and test_manifest_size.py; bound supported FastMCP/MCP runtime, verify prefix/site isolation, and distinguish missing optional runtime from failed installed-server handshake. Verify dedicated install and suite without altering global Python (FR-005, FR-008).

- [x] T043 [US1] Reproduce/fix A124-013 in mcp-servers/rag-mcp/rag_mcp_server.py and tests/unit/test_rag_ingest_guards.py; add fastmcp<3 to unit manifest for real module wiring, test rejected scope produces zero ingest calls and valid scope still ingests (FR-003, FR-005).
- [x] T044 [US1] Fix A124-014 with bounded decoded streaming in mcp-servers/rag-mcp/ingestion/url_fetcher.py and tests/unit/test_rag_url.py; pass configured max bytes from rag_mcp_server.py and verify closed streams (FR-003, FR-005).
- [x] T045 [US1] Reproduce A124-015 and isolate HUD upload staging in server.js/new src/security/rag-upload.js with tests; retain document titles and clean only per-request staging after ingestion (FR-003, FR-005).
- [x] T046 [US2] Reproduce/fix A124-016 interrupted-ingest sweep ordering in rag_mcp_server.py with persistent-store regression in tests/unit/test_rag_ingest_guards.py (FR-005).

- [x] T047 [US4] Add name/description YAML to the fifteen SKILL.md files listed in evidence/skill-mcp-static-summary.json (checkpoint, ipfabric, multivendor-device-query/fleet-ops/raw-cli, rag, threejs-network-viz, four twilio skills, four twitter skills); validate YAML/discovery and preserve operational authorization (FR-010).

- [x] T048 [US1] Fix A124-018 in mcp-servers/twilio-voice-mcp/webhook_server.py with centralized signature/bearer authentication and interactive caller checks; add tests/unit/test_twilio_webhook_security.py proving rejected callbacks/alerts cannot dispatch work, supported signed requests pass, and forwarded host headers cannot select a signing origin (FR-003, FR-005).
- [x] T049 [US3] Add scripts/migrate-voice-auth.py and tests/unit/test_voice_auth_migration.py, docs/VOICE-SECURITY.md, .env.example, .gitignore and README.md guidance: preview missing variable names only, apply secrets from environment or hidden prompt, generate separate alert token, backup with restrictive permissions, atomic writes, idempotence, recovery (FR-007, FR-010).
- [x] T050 [US1] Fix A124-019 in webhook_server.py using verified CML HTTPS by default with CML_CA_BUNDLE/explicit CML_VERIFY_SSL override; document existing lab adoption and test client configuration (FR-003, FR-005, FR-007).

- [x] T051 [US1] Restrict primitive cache deserialization in mcp-servers/rag-mcp/storage/bm25_store.py and test legacy compatible load/rejection in tests/unit/test_rag_hybrid.py; reject pickle globals and malformed cache shapes without rewriting original files (FR-003, FR-005).

- [x] T052 [US4] Repair two six-cell MCP table rows under the five-column README.md header (Infrahub/Itential), preserve their setup variable names in the capability cell, and render changed guidance/table excerpts for review (FR-010). Full README rewrite remains phase3b.

- [x] T053 [US3] Resolve A124-021: support modern pyATS Streamable HTTP/stateless runtime and native pCalls through tracked installation, isolated dependencies, lifecycle/config migration with rollback, revised consumers/skills, and legacy-to-modern acceptance tests. Preserve device change gates and loopback access boundary (FR-003, FR-007, FR-010).
- [x] T054 [US3] Resolve A124-005 with tracked shared-runtime constraints in config/python-shared-constraints.txt, mandatory enforcement in scripts/lib/pip-helper.sh, effective-bound verification in scripts/check-dependency-pins.py, dependency resolution evidence and negative tests. Keep dedicated MCP2/FastMCP3 environments exempt by explicit NETCLAW_VENV, not shared upgrades (FR-003, FR-005, FR-007).
- [x] T055 [US3] Correct interpreter selection and PEP668 handling in scripts/lib/pip-helper.sh: honor the runtime PATH, refuse implicit system-package override, document venv migration, update tests/reconcile/run-tests.sh and verify failures remain failures (FR-003, FR-007, FR-009).
- [x] T056 [US1] Fix A124-022 in internal_security.py, internal_channel.py, service.py and bgp-daemon-v2.py; add verified remote TLS, safe loopback defaults, TLS-bound possession/attestation, migration script/docs and real TLS negative/positive tests (FR-003, FR-005, FR-007).
- [x] T057 [US2] Fix A124-023 integration live opt-ins, declared dependencies/isolation, stale RAG schema assertion, UE5 explicit-role inference and deterministic reconcile fixture; run integration/reconcile suites (FR-004, FR-005, FR-008).
- [x] T058 [US1] Fix A124-024 Zoom pending-RPC cleanup and bounded investigation admission in zoom_channel.py; add offline cancellation/send-error/duplicate/limit tests (FR-003, FR-005, FR-006).
- [x] T059 [US2] Add verified macOS Kubernetes binary digests to tests/contract-suites.json and CHECKSUMS; make installed-manifest probe failures fail visibly; run Mac contracts and report cluster gaps separately (FR-008, FR-014).
- [x] T060 [US1] Fix A124-025 Zoom RTMS webhook signature/timestamp/size/shape validation and loopback default; add real local HTTP negative/positive tests and existing-user environment migration/docs (FR-003, FR-005, FR-007).
- [x] T061 [US2] Add previously unregistered first-party protocol/Zoom/GNS3 tests to declared suite coverage, repair stale mocks/expectations while preserving assertions, and run EVE skill smoke separately from disruptive lab tests (FR-001, FR-008).
- [x] T062 [US1] Fix A124-026 Zoom panel isolation with panel_auth.py and authenticated WebSocket handshake in panel_feed.py/panel.js, remove anonymous active-meeting fallback and sensitive TRACE logs, validate ciphertext/expiry/audience/cross-meeting behavior, document migration (FR-003, FR-005, FR-007).

- [x] T063 [US1] Fix A124-027 direct MCP base64 ingestion with pre-decode limits, strict validation, isolated request staging and cleanup; test malformed/oversized/concurrent uploads (FR-003, FR-005).

- [x] T064 [US1] Fix A124-028 installer environment writes in scripts/lib/common.sh using a private atomic writer; verify special-character preservation, shell quoting, idempotence, duplicate assignment replacement and symlink refusal (FR-003, FR-005, FR-009).
- [x] T065 [US2] Under T017, benchmark and implement bounded reuse of validated generic GCF snapshots in src/netclaw_tokens/gcf_serializer.py; verify caller mutations invalidate reuse, oversized payloads bypass the cache, source fidelity remains unchanged, and record before/after cost (FR-005, FR-006).
- [x] T066 [US2] Fix A124-029 mobile EdgeClient pending-call/send/parse/handler/close failure handling and failed-handshake socket cleanup in mobile/netclaw-mobile/lib/ncfed/edge_client.dart; exercise actual client with injected channels, then serial Flutter tests/analyze (FR-003, FR-004, FR-005).
- [x] T067 [US1] Fix A124-030 Redfish's unverified TLS default in mcp-servers/redfish-mcp/client.py, add custom CA support and explicit lab-only opt-out, migration script and tests; update hardware-health-check skill and runtime docs, rerun Redfish contracts (FR-003, FR-005, FR-007, FR-010).
- [x] T068 [US2] Fix A124-031 RAG replacement/reindex data loss in rag_mcp_server.py: retain the previous ready version until replacement indexing succeeds, bypass dedupe only for explicit confirmed reindex, clean failed new index entries, and verify failure/success against persistent stores (FR-004, FR-005).
- [x] T069 [US2] Fix A124-032 mobile release metadata drift in ios/Runner.xcodeproj/project.pbxproj and archive/export workflow; add a built-bundle version/identifier gate, verify actual iOS/watch/widget outputs and prepare a local archive without uploading (FR-004, FR-005, FR-010, FR-014).
- [x] T070 [US4] Fix A124-033 copied read-only retry claims across workspace/skills/*/SKILL.md; distinguish confirmed reads from potentially completed writes, retain authorization/change gates, record exact affected paths and verify representative mutating tool contracts (FR-003, FR-010).
- [x] T071 [US2] Fix A124-034 boundary coordinates violating Three.js Vector3 float serialization in workspace/skills/threejs-network-viz/topology_model.py; add deterministic integer-boundary regression and rerun affected scene tests (FR-005).
- [x] T072 [US2] Fix A124-035 BM25 cache persistence/concurrency in storage/bm25_store.py with atomic private replacement and serialized read-modify-write; test simulated write failure and concurrent additions against reloaded disk state (FR-004, FR-005).
- [x] T073 [US1] Fix A124-036 ANTA eAPI TLS enforcement and three Nautobot client defaults; require ANTA1.10 SSLParameters with hostname verification, close each ANTA device, support trusted private CAs, update registration/docs/skills and extend the transport migration CLI/tests (FR-003, FR-005, FR-007, FR-010).
- [x] T074 [US1] Fix A124-037 production change gates in gNMI/Claroty ITSM modules, Fortinet gates.py and multivendor tools/change.py; reject malformed/query-injected or mismatched CRs, require approved Implement state, implement missing read-only ServiceNow verification, fail closed on unavailable/error, provide migration/preflight/docs and negative/positive tests (FR-003, FR-005, FR-007, FR-010).
- [x] T075 [US1] Fix A124-038 raw multivendor command approval bypass: keep tools/raw.py read-only even when write tools are enabled; verify configuration commands are refused before connection and document migration to gated apply_config (FR-003, FR-005, FR-007).
- [x] T076 [US1] Fix A124-039 multivendor SSH trust defaults in raw/change/facts drivers with strict known-host verification, explicit trusted-host configuration and migration; verify unsupported SDK adapters fail closed, fixture host-key rejection/acceptance, private baselines and failed-session cleanup (FR-003, FR-005, FR-007).

- [x] T077 [US3] Fix A124-040 in scripts/gait-venv-setup.sh with a staged verified runtime, retained backup/restore, symlink safety and failure tests; use the isolated runtime from component_install_gait, avoid global package mutation, document existing-user recovery (FR-003, FR-005, FR-007, FR-009).
- [x] T078 [US3] Fix A124-041 in scripts/lib/install-steps.sh: remove automatic PEP668 override and direct ComfyUI pip bypasses, preserve explicit isolated runtime selection, test real prerequisite/helper behavior and reconcile installer claims (FR-003, FR-005, FR-009).

- [x] T079 [US2] User-authorized mobile upload: verify App Store Connect account/build state, increment mobile/netclaw-mobile/pubspec.yaml to unused1.0.2+4, rebuild/validate/export/upload signed IPA, inspect remote processing and record human steps without submitting a public release (FR-004, FR-010, FR-014).

- [x] T080 [US1] Fix A124-042 in mcp-servers/analysis-mcp/loader.py by rejecting denied resolved paths even inside a broad authorized root; add actual discovery regression and rerun analysis contracts (FR-003, FR-005).

- [x] T081 [US1] Fix A124-043 in mcp-servers/auvik-mcp/clients/auvik_client.py with same-origin request validation before dispatch; test malicious links.next against MockTransport and valid same-origin pagination; record no migration for legitimate same-origin callers (FR-003, FR-005).

- [x] T082 [US1] Fix A124-044 memory/RAG GAIT API usage and dependency declarations; expose recorded/unavailable audit status on mutation results, verify real temporary GAIT commits and unavailable-store reporting without touching operator history (FR-003, FR-005, FR-010, FR-011).

- [x] T083 [US2] User-authorized public mobile release: inspect existing App Store listing/review metadata, prepare1.0.2 with uploaded build4 and accurate bug-fix notes, select automatic release after approval, submit review if requirements are satisfied, and report Apple/human blockers without inventing legal declarations (FR-010, FR-014).

- [x] T084 [US1] Fix A124-045 syslog TCP unbounded buffering/task admission, incorrect peer identity and active-client shutdown in mcp-servers/syslog-mcp/tcp_receiver.py; verify real loopback delivery, resource rejection and stop cleanup in tests/unit/test_syslog_tcp_limits.py; document framing and limits (FR-003, FR-005).

- [x] T085 [US1] Resolve A124-046 telemetry GAIT placeholders in syslog/snmptrap/ipfix gait_logger.py and affected status/docs; explicitly distinguish ordinary logs from persisted GAIT records, verify failure visibility and avoid an unbounded per-message audit workload (FR-003, FR-005, FR-010, FR-011).

- [x] T086 [US1] Fix A124-047 in the three telemetry udp_receiver.py implementations: enforce pending-handler admission before task creation, count dropped datagrams, cancel/join owned tasks on stop and expose transport counters through receiver status; verify overload and normal delivery/shutdown (FR-003, FR-005).

- [x] T087 [US2] Fix A124-048 direct/module package startup for the three telemetry MCP servers and the shadowed bytes annotation in ipfix-mcp/models.py; declare a telemetry suite with actual parser/runtime dependencies and test stdio initialization/tool discovery/status plus localhost syslog ingestion/audit shutdown (FR-004, FR-005, FR-008, FR-010).

- [x] T088 [US3] Fix A124-049 in scripts/run-contract-tests.py: restrict environment destinations, refuse unowned runtime replacement, preserve managed runtime on failed preparation, and test negative paths plus successful/failed refresh in tests/unit/test_contract_runtime_preservation.py (FR-003, FR-005, FR-007, FR-009).

- [x] T089 [US3] Resolve A124-050 in shared helpers in scripts/migrate-voice-auth.py and its six environment-migration consumers: record private after-state digest, reject conflicting/legacy restore without overwrite, and test successful/repeated/conflicting/interrupted restore while preserving unrelated values (FR-005, FR-007, FR-009).

- [x] T090 [US1] Fix A124-051 through ui/netclaw-visual/src/security/safe-html.js and all main/panel HTML sinks; use maintained DOMPurify, test adversarial DOM and rendering preservation, and rerun Node tests/build/browser checks (FR-003, FR-005, FR-010).

- [x] T091 [US1] Fix A124-052 with ui/netclaw-visual/src/security/private-files.js, wire HUD env/testbed/config updates, test literal values/injection/private atomic writes/recovery, and add scripts/migrate-local-file-permissions.py with preview/apply/restore tests and docs (FR-003, FR-005, FR-007, FR-010).

- [x] T092 [US2] Fix A124-053 in federation/channel.py and edge.py: unconditional pending cleanup, bounded send/response deadline and reliable close completion; test send failure/cancellation/timeout/disconnect and successful response using actual classes, then rerun n2n contracts (FR-003, FR-005).

- [x] T093 [US1] Fix A124-054 with process-wide count/byte admission in federation/channel.py, reject overload before spawning, release reservations when handlers settle, test cross-channel/byte-limit recovery and preserve heartbeat multiplexing; document overload behavior (FR-003, FR-005, FR-006).

- [x] T094 [US2] Fix A124-055 HUD RAG subprocess command construction for checkout paths containing spaces/apostrophes in server.js and src/security/command.js; verify the generated command with the actual Python shlex parser (FR-005, FR-014).

- [x] T115 [US3] Reproduce/fix A124-075 skill deployment overwriting operator content or following destination links in scripts/lib/install-steps.sh; add scripts/deploy-skills.py with private retained backups, link refusal, incoming-only runtime substitutions and conflict-aware recovery; verify actual deployment and restore fixtures.

- [x] T116 [US2] Reproduce/fix A124-076 edge queue replay/counts retaining expired messages when no new enqueue occurs in federation/edge_queue.py; filter expired rows on pending/depth/depths and test actual SQLite queue with elapsed time before any new write.

- [x] T117 [US2] Reproduce/fix A124-077 malformed pricing overrides and non-finite cost poisoning in src/netclaw_tokens/cost_calculator.py and session_ledger.py; validate override shapes/ranges and ledger cost admission, then prove invalid cost cannot bypass budget checks in tests/unit/test_token_cost_validation.py.

- [x] T118 [US2] Reproduce/fix A124-078 malformed/error Fortinet JSON-RPC envelopes reported as successful empty data in transport/jsonrpc.py and envelope.py; add actual MockTransport-to-manager response regressions in tests/fortinet/test_rpc_errors.py and register in run-tests.sh.
- [x] T119 [US2] Reproduce/fix A124-079 fractional BGP_INTEL_MAX_RPS causing zero-capacity limiter IndexError in bgp-intel-mcp/http_client.py; verify observed sub-one-per-second pacing in tests/bgp-intel/test_rate_limit.py.

- [x] T120 [US1] Reproduce/fix A124-080 production model guard reporting available for disabled/unrouted configurations and embedded direct-model overrides in federation/controls.py and gateway.py; validate effective provider/primary/fallback route and security mode before delegation, test fixture configs, and document existing production adoption.

- [x] T121 [US1] Reproduce/fix A124-081 invocation grants/budgets becoming stale across approval/guard waits and skill scheduling in authorization.py/invocation.py; revalidate original grant before execution, reserve request allowance before awaits, count replication requests and test revocation/concurrent admission using real SQLite/service handlers.

- [x] T122 [US3] Reproduce/fix A124-082 remaining credential serialization in scripts/setup.sh, openclaw-to-hermes-mcp.py and normalize-mcp-cwd.py; remove prompt eval/sed writes, reuse literal dotenv decoding and private atomic file writes from write-env.py, verify malicious-looking literal input and generated YAML/private file behavior.

- [x] T123 [US2] Reproduce/fix A124-083 malformed list replies becoming successful empty results in Claroty _extract_items, Halo pagination/get_all and Auvik merge_page/get_all; preserve valid empty lists and expose partial/error state in actual client regressions under tests/unit/test_vendor_list_failures.py; propagate failed/incomplete name resolution through Halo/Auvik utils/resolver.py.

- [x] T124 [US3] Reproduce/fix A124-084 setup replacing operator USER.md and Twilio whitelist/config, including unescaped JSON labels; add scripts/setup-profile.py for private retained-original updates, managed identity section and whitelist merge, wire setup.sh and verify preservation/repeat/malformed-input cases.

- [x] T125 [US1] Reproduce/fix A124-085 federation result files overwritten by repeated peer-controlled request ids and false result references on failed persistence in audit.py/tasks.py; create exclusive private result files, expose unavailable results and retain failed terminal task state when storage fails; verify duplicate ids and actual task storage failure.

- [x] T126 [US4] Correct A124-086 Azure ordinary logger mislabeled GAIT persistence in azure_network_mcp_server.py and README.md; name emitted records operation logs and use returned rather than success for functions that return error envelopes. Preserve tool registration and explicitly require session GAIT recording.

- [x] T127 [US2] Fix A124-087 floating Flutter CI toolchain changing locked SDK dependencies and failing clean plugin preparation; pin the verified Flutter 3.44.8 in .github/workflows/mobile-ci.yml, trigger CI on workflow edits and validate actual macOS analysis/tests/native builds.

- [x] T128 [US1] Fix A124-088 standalone credential writers in checkpoint-enable.sh, ipfabric-enable.sh, forward-enable.sh, twilio_install.sh, twitter_install.sh and twitter_oauth2_setup.py; replace peering prompt eval/literal decoding and patch-claw-certs env writes; reuse safe writer/profile preservation and prove actual helper/interactive fixture behavior.

- [x] T129 [US2] Extend A124-061 to standalone dependency/build/smoke failures in checkpoint-enable.sh, forward-enable.sh, twitter_install.sh and twilio_install.sh. Use the existing scoped PEP668-safe pip helper; prove required failures exit nonzero before configuration and report no successful installation.

- [x] T130 [US1] Fix A124-089 OAuth callback state/path binding and unbounded waits in scripts/twitter_oauth2_setup.py; verify real loopback callback rejection/acceptance in tests/unit/test_oauth_callback_state.py, bound provider exchange and save returned tokens privately without logging secrets.

- [x] T131 [US1/US3] Fix A124-090 blank/unresolved TLS settings silently disabling verification in seven first-party clients and vendored Zabbix startup; normalize only explicit false values, add scripts/zabbix-stdio.py without modifying upstream, repair CML/Redfish default registration and add preview/apply/repeat/recovery config migration in scripts/migrate-tls-registration.py. Test actual startup expressions, vendored parser through wrapper and old-state migration preservation.

- [x] T132 [US2] Fix A124-091 ANTA broad applicability regex hiding real/mixed failures in anta-mcp/verdict.py; require narrow complete command-unavailable evidence for every message, test actual verdicts and update the guide.
- [x] T133 [US2] Fix A124-092 Redfish power transitions reported as completed states in redfish-mcp/verdict.py; expose POWERING_ON/OFF with transition caveats, test all four states and retain completed-state behavior.

- [x] T134 [US1] Fix A124-093 chat session ownership/path traversal and concurrent budget admission in federation/chat.py and authorization.py; validate inbound/outbound session binding, refuse unsafe transcript paths/links, persist privately without swallowing errors, reserve request allowance before model waits and verify real SQLite/filesystem/async regressions.

- [x] T135 [US2] Fix A124-094 unchanged certificate issuance reported renewed and same-key renewals retired in federation/rotation.py; require a changed valid certificate before success and retire only a different predecessor key fingerprint. Reproduce actual registry state with unchanged CA/hub/ACME and renewed same-key certificate fixtures.

- [x] T136 [US1] Fix A124-095 ACME subprocess surviving timeout/cancellation in federation/acme.py; isolate the child process group, terminate/reap on failure and verify real local subprocess timeout/cancel/success cases without ACME or DNS calls.

- [x] T137 [US1/US3] Fix A124-096 automatic host certificate renewal replacing the pinned key without a working successor handler in federation/rotation.py/certs.py; renew the certificate with the existing key, atomically preserve installed identity and test a real remote pin across renewal. Correct key-rollover claims; deliberate key replacement continues to require operator re-verification.

- [x] T138 [US1/US2] Fix A124-097 inventory advertisement visibility/escaped secret bypass and unsafe cache path/freshness; verify actual encoded credentials, aggregate visibility, filesystem boundaries and UTC timestamps, then full federation contracts.

- [x] T139 [US1/US3] Fix A124-098 replication repeat-start/promotion data loss across replication.py, registry.py and chroma_store.py; stage every transfer, validate page cardinality/uniqueness, transactionally publish registry and retain/restore prior vectors on callback failure. Prove real retained corpus and registry after failures and successful replacement; document cross-store interruption recovery.

- [x] T140 [US1/US4] Fix A124-099 GRE lab scripts changing unrelated bridges/routes in lab/frr-testbed/scripts; remove global bridge mutation, bind route removal to lab tunnel, correct IPv6/failed-convergence diagnostics and stale README. Verify actual scripts with isolated command recorders and bash syntax checks.

- [x] T141 [US1/US2] Fix A124-100 Canvas conversation/session crossing and persistence false success in App.jsx and session-gate.js; verify production session handlers plus pending-request/save admission, retain state on storage failures and prevent deleted-session recreation. Run HUD tests/build and record browser acceptance scope.

- [x] T142 [US2] Fix A124-101 ui/netclaw-zoom-app panel/overlay false enabled state and partial-start cleanup; verify actual panel click handlers and mocked SDK failure cleanup, retain explicit live entitlement gap.

- [x] T143 [US1/US3] Fix A124-102 mobile device-deep-link automatic prompt text injection in lib/ncfed/device_deep_link.dart; constrain URI and decoded identifier, test no RPC for hostile links and valid existing links, document QR/manual-query adoption.

- [x] T144 [US1/US2] Fix A124-103 mobile lifecycle client/listener ownership in main.dart, background_refresh.dart, deep-link listeners and AppDelegate.swift; verify actual widget late completion, late/error headless cleanup and native simulator compilation after selective grouped engine registration.

T021 bounded acceptance disposition: completed Docker Debian/systemd, isolated WSL and historical macOS runtime/native CI evidence accepted per explicit user instruction. No bare-metal Linux boot or wiped-Mac installation claim; limitations in deferred-review.md.

Final bounded gate:144/144task dispositions complete under the scope amendment; this is not100% semantic review. Native CI36326574760 validates103 production source;1709ddc only changes test synchronization. Operator migration is the separately ordered post-main execution phase.
