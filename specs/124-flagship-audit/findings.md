# Flagship audit findings — bounded closeout

Baseline: ad6a4a8. Inventory coverage is not completed review. Confirmed findings receive stable A124 IDs and exact remediation tasks before fixes. Severity and verification status are separate.

## Current status — authoritative checkpoint

The user bounded closeout on2026-09-27. Confirmed001–103 repairs are implemented; all final local and native103 checks passed. All751 previously pending baseline paths are explicitly deferred in [deferred-review.md](deferred-review.md), not passed.461 paths have targeted review and271 measured execution; neither is full-file certification. Existing finding/acceptance evidence yielded no further confirmed safe-use release blocker during bounded triage.

Completed acceptance includes Docker Debian real systemd fresh/upgrade, isolated WSL fresh/upgrade and recovery, historical Windows Edge chat, current WSL Chromium Canvas checks, a separate real model request, CML12/12 read-only checks, NSM19 and Redfish15 fixtures. Historical Mac runtime and native CI evidence remains valid at its recorded checkpoint. Physical phone/watch, live optional providers, wiped Mac and bare-metal Linux acceptance remain unverified. Actual local migration completed after merge and return to main; evidence/wsl/operator-adoption.json records outcomes and optional gaps.

| IDs | Current disposition |
|---|---|
| 001, 007, 015 | HUD access boundary, dependency and upload fixes verified by tests/build and synthetic Chromium checks |
| 002, 008–010, 012, 023 | Test isolation, runtime assumptions and dependency declarations repaired; serial Flutter tooling resolves the initial contention |
| 003 | Lossless GCF source preservation and bounded cache verified; repeated synthetic 1,000-node encoding improved from roughly18–20ms to4–5ms with identical output size |
| 004, 006, 017, 033 | Counts, GAIT contract, discovery headers and100 unsafe blanket retry claims corrected; broad skill semantic review remains open |
| 005, 028 | Shared runtime constraints and private literal environment writes verified, including dotenv quoting and recovery fixtures |
| 011, 022, 024 | Federation deadlines, internal TLS identity and Zoom task/RPC lifetime repairs verified offline, including real local TLS fixtures |
| 013–014, 016, 020, 027, 031, 035 | RAG consent, bounded ingestion, cache loading, replacement recovery and atomic BM25 persistence verified with temporary stores |
| 018–019, 025–026 | Voice/CML TLS and Zoom webhook/panel authorization fixes verified offline; real provider acceptance remains open |
| 021 | Tracked isolated stateless HTTP pyATS runtime/bridge/migration implemented; fresh install and actual Mac runtime exercised; native pCalls passed against CML |
| 029, 032 | Mobile client lifecycle and bundle-version repairs verified:430 Flutter tests, clean analyze, signed archive/export/upload and public review submission; real-device acceptance remains open |
| 030, 036 | Redfish, Nautobot and ANTA verified TLS defaults/private CA migrations tested; live appliances unavailable |
| 034 | Three.js integer-boundary serialization regression repaired and tested |
| 037 | gNMI/Claroty/Fortinet/multivendor production gates fail closed and require exact approved Implement CR; synthetic transport and migration tests pass |
| 038–039 | Raw multivendor write bypass removed; strict SSH identity, private baselines and failed-session cleanup verified; live FRR rejects unknown/mismatched keys and accepts independently trusted key |
|040–041,049–050|Isolated installer/runtime recovery, PEP668 refusal, test-runtime preservation and conflict-safe environment restores verified with failure fixtures|
|042–044|Analysis path denial, Auvik same-origin credentials and actual Memory/RAG GAIT persistence verified|
|045–048|Bounded TCP/UDP receivers, real telemetry GAIT persistence/status and actual stdio startup verified; seven MCP integration tests pass|
|051–052|HUD HTML sanitization and literal/private atomic config/testbed/layout writes verified with adversarial DOM, filesystem and browser checks|
|053–054|Federation pending-call cleanup and global dispatch admission verified;490 n2n tests pass|
|055|HUD RAG command construction preserves spaces, quotes and metacharacters through the actual Python parser|
|056–057,061|Actual installer/deployment preservation, literal writes and failure exits verified; N2N component failure propagation covered|
|058,060,062–063|Snapshot credentials, false-empty RAG errors, recoverable Chroma promotion and Office expansion/page limits verified|
|059|Redfish wrong-service probe corrected; isolated fixture15/15 passes|
|064|Staged pyATS runtime/source adoption and rollback verified on WSL; Docker Linux installer adoption passes|
|065–067|Budget validation, memory filter/error semantics and CLI/systemd literal configuration verified|
|068–069|Fail-closed federation role admission and approval expiry verified at real service/SQLite boundaries|
|070|Mobile late headless connection cleanup verified;431 Flutter tests and clean analyze on WSL|

Bounded scope supersedes the former open-ended review requirement. Deferred semantic review and optional acceptance remain explicitly unverified; final checks govern merge readiness. Descriptions below retain discovery-time observations.

## Severity index — closeout triage

Severity describes pre-fix impact, not residual known exposure. All listed findings have implemented repairs;103 native verification passed. Original discovery wording below is retained as history.

| Severity | Findings |
|---|---|
| Critical | 018, 037, 038 |
| High | 001, 003, 007, 011, 013, 019, 021, 022, 025, 026, 027, 028, 029, 030, 031, 033, 035, 036, 039, 044, 045, 047, 051, 053, 054, 056, 057, 058, 060, 061, 062, 063, 064, 065, 066, 068, 071, 072, 075, 080, 081, 082, 085, 088, 089, 090, 091, 093, 094, 095, 096, 097, 098, 099, 100, 102, 103 |
| Medium | 002, 004, 005, 006, 008, 009, 010, 012, 014, 015, 016, 017, 020, 023, 024, 032, 034, 040, 041, 042, 043, 046, 048, 049, 050, 052, 055, 059, 067, 069, 070, 073, 074, 076, 077, 078, 079, 083, 084, 086, 087, 092, 101 |

## Trust boundaries

### WSL continuation findings

- **A124-073 — Medium — HUD resource identifiers can escape their data roots.** Skill and session detail routes join decoded URL identifiers directly to filesystem paths; encoded separators can select outside SKILL.md or transcript files, and symlinks can escape too. The HUD remains local-operator-only after001; this is confinement within that trusted interface, not a demonstrated remote authentication bypass. T113 reproduces real HTTP traversal and constrains resolved regular files to their intended roots.
- **A124-074 — Medium — HUD misreports zero/invalid budgets.** `resolveBudgetPolicy` uses truthiness defaults, turning a valid zero ceiling into5USD and zero call allowance into20. It also accepts non-finite environment values inconsistent with the repaired Python policy; percent computation treats a zero ceiling as0% usage. T114 mirrors validated layered limits and reports an immediate zero ceiling as halted.

- **A124-071 — High (audit integrity) — other skills still call the obsolete GAIT schema.** Eighteen literal examples across17 skills use either `{input:{role,content,artifacts}}` or `prompt`/`response`, which the installed server silently ignores: the probe returned success but `gait_show` proved both recorded text fields empty. The main GAIT skill was corrected earlier, but these callers were missed by static extraction of external tool schemas. T111 updates all discovered callers and verifies against the actual schema, without treating illustrative network outcomes as observations.
- **A124-072 — High (workflow) — ACI guide allows an insufficient approval state.** The deployment skill says proceed if state is `implement` OR `approved`; repository policy requires approved authorization AND Implement lifecycle state. T112 makes that gate explicit, binds it to the intended CR and preserves baseline/verification requirements. This is a guide defect, not evidence that an external APIC server enforces or bypasses a gate.

- **A124-070 — Medium — mobile headless timeout leaves late connections unowned.** `connectHeadless` wraps reconnect in `Future.timeout`, which stops waiting but does not cancel the underlying future. A later successful reconnect produces a live authenticated client that no caller receives or closes. T110 closes late results while preserving normal ownership on timely success; no enrollment-data change.

- **A124-069 — Medium — approval resolution ignores its expiry.** Expiry is updated only when `approval_status` polls a pending row. Resolving an elapsed pending row first changes it to approved, and subsequent status checks no longer examine expiry. Listing also includes elapsed rows. This is a proven approval-state/audit defect; task execution after expiry is not claimed because the waiter has a separate deadline. T108 enforces expiry at resolution/list boundaries and reports refusal to HTTP/mobile callers.

- **A124-068 — High — unavailable role state admits external federation.** `FederationService._en2n_allowed` catches any role-store failure and returns true, violating member isolation exactly when its role cannot be established. T107 permits only known standalone/border roles and refuses incoming/outgoing external peering on error. It does not change valid member/internal routing.

- **A124-067 — Medium — CLI role persistence corrupts names and misreads hardened environment files.** Actual `env_set` given `lab & primary` stores `lab N2N_RISK_NAME=old primary` through sed replacement expansion. `env_get` returns literal quote wrappers and reads stale dotenv ahead of the systemd file the writer prefers. T106 uses shared atomic updates with explicit systemd-compatible quoting and matching decoded read precedence; unrelated settings remain intact.

- **A124-065 — High — non-finite budget configuration disables the cost ceiling.** `float('nan')` is accepted as the session cap, so even a million-dollar spend never compares above it. Invalid config values also crash loading; boolean fields enter integer coercion first. T104 preserves valid lower-layer settings on invalid input and validates finite nonnegative limits and explicit booleans.
- **A124-066 — High (correctness) — memory filters return false empty success.** Real Chroma rejects `$gte` on the stored ISO timestamp; `$contains` on comma-separated topic strings produces no match even for the stored topic. Errors and unavailable embedding/storage are reported as success. T105 uses bounded retrieval with compatible metadata filtering, explicit partial-search disclosure and typed failure results; existing corpus bytes remain unchanged.

- **A124-064 — High — failed pyATS update invalidates the working runtime.** A real isolated Python3.12 venv could import its sentinel before install; the existing component recreated it under ambient Python3.14 before a synthetic pip failure, after which the sentinel was no longer importable. The installer also switches its upstream clone before verifying dependencies. T103 stages a pinned source checkout and dedicated Python3.12 environment, verifies them before promotion, and retains the previous runtime. Evidence: private `pyats-failure-before.txt` (no operator state touched).

- **A124-063 — High (availability) — Office ingestion bypasses expanded-size and page limits.** The dispatch checks compressed file bytes only; modern Office parsers never receive `max_pages` and their resulting page counts are not checked. Small ZIP-backed inputs can expand far beyond the configured document cap. T102 preflights declared ZIP expansion and enforces sheet/slide/page counts before extraction, with a final dispatch check.

- **A124-062 — High — replica promotion removes the previous corpus before replacement succeeds.** `ChromaStore.promote_staging` deletes the stable collection, ignores deletion errors, then creates/renames staging. A rename failure loses the old corpus; missing staging can even be created empty. T101 requires existing staging, retains the prior collection under a rollback name, and restores it on promotion failure. Abrupt process interruption must leave recoverable data and explicit guidance.

- **A124-061 — High (reliability) — installer reports success after failed installation.** Final problem reporting never exits nonzero; `core_tokens` also swallows dependency failure and claims readiness after trying an unrelated `toon-format` fallback. Automation can proceed on a broken installation even when component logs identify failure. T100 propagates dependency failure and returns a failed overall result while retaining component logs and successful components.

- **A124-060 — High — failed RAG storage reported as empty corpus.** `ChromaStore.count` catches every exception and returns zero; `_do_search` translates that into successful `corpus_empty: true`. An unavailable/corrupt index becomes a false absence finding. T099 preserves storage failure and emits a sanitized `STORAGE_UNAVAILABLE` response without embedding work or an empty-corpus success.

- **A124-059 — Medium — Redfish harness treats HTTP errors as a fixture.** WSL's occupied port 8000 returns 404 for `/redfish/v1`; `curl -s` still exits zero and the harness enters live tests, failing 1/15 while the runner correctly marks the service unavailable. T098 requires successful HTTP and permits a dedicated fixture URL so acceptance never displaces an operator listener. Evidence: private WSL contract baseline.

- **A124-058 — High — snapshot scrubber retains explicit plaintext enable credentials.** The enable-secret regex recognizes types 5/7/8/9 but not explicit type 0, so `enable secret 0 synthetic-secret` redacts the `0` and leaves the credential in content sent to indexing. Single-token matching also leaves multiword enable-password suffixes. Repair T097 covers both forms; old snapshots are not silently rewritten or claimed safe.

- **A124-056 — High — deployment bypasses literal environment writer.** Source review found `core_deploy` redefining `_set_env_var` with sed interpolation, overriding common.sh's atomic private writer. Paths containing `&`, `|`, spaces or quotes can corrupt runtime assignments, and fresh files inherit umask. Existing writer tests exercise only common.sh, missing the actual caller. T095 adds deployment-level regression coverage before repair.
- **A124-057 — High — upgrade overwrites operator workspace state.** `core_deploy` unconditionally copies USER/TOOLS/persona files and replaces the workspace testbed link, also resetting configured RAG/Memory directories. Re-running install can lose user notes or hide existing knowledge/testbed state. T096 changes these bootstrap operations to preserve existing operator state and documents adoption; it must not pretend overwritten historical data can be recovered without a prior backup.

Review sequence: install/supply chain and local configuration → HUD HTTP/WebSocket/process/filesystem → Border/member/peer identity and tool execution → RAG/memory ingestion and replication → mobile/watch approval/enrollment → voice/Zoom external input → remaining per-vendor tool boundaries → skills and public claims.

## Findings

Planning inconsistencies are recorded separately in analysis.md.

### A124-001 — High — HUD has no network/browser access boundary

Status: confirmed by source; synthetic HTTP/WebSocket reproduction pending before fix. `ui/netclaw-visual/server.js` uses unrestricted cors(), server.listen(PORT) without host, and WebSocketServer without origin validation. Credential/testbed/config/chat routes have no prior authorization. `package.json` starts Vite with --host, exposing its backend proxy too. Impact: reachable clients can invoke privileged local functions; unrelated web origins can read API responses. Fix contract: loopback-only API and frontend, exact loopback Host/Origin allowlist on HTTP/WS, reject cross-site/opaque origins, retain origin-less loopback CLI. Remote users migrate to SSH forwarding; public/LAN unauthenticated service is intentionally no longer supported.

### A124-002 — Medium — GCF suite omits its primary dependency

Status: confirmed. Baseline token-budget has 12 failures / 60 tests; logs show ModuleNotFoundError: gcf. Manifest declares only pytest while source requirements specify gcf-python==2.2.1. Fix: declare dependency/import preflight and establish actual test outcome before CI inclusion.

### A124-003 — High — Graph compression drops operational fields

Status: source-confirmed; reproduction pending with installed GCF. `_build_payload` retains node identity/role-derived distance and edge endpoints/type, but discards other node/edge attributes and sibling envelope fields. Delta compares only the reduced representation. Error/provenance/metric changes can disappear from the agent's evidence. Fix must preserve all original information and test changed-attribute cases, not merely token savings.

### A124-004 — Medium — Inventory claims disagree with computation

Status: confirmed. Reconciliation computes 172 MCP integrations while four README/SOUL claims say 173. Investigate catalog truth before changing counts; evidence: reconcile-baseline.txt.

### A124-005 — Medium — Installed external dependencies trigger reconciliation failures

Status: confirmed environment-dependent baseline failure. Seven unbounded-submodule dependency findings span installed external clones. Determine what tracked installer guarantees and whether scan includes untracked local clones; do not patch ignored third-party source as a repository fix.

### A124-006 — Medium — GAIT skill arguments and lifecycle drift

Status: confirmed against the locally installed server. Documented branch_name/prompt/response/artifact string parameters differ from name/user_text/assistant_text/object artifacts. Creating a branch does not check it out. The skill falsely calls mutating tools read-only. Reconcile against the supported fetched server contract; do not imply every installation is identical.

### A124-007 — High — HUD lockfile resolves vulnerable dependencies

Status: confirmed by npm audit against installed lockfile: 12 affected packages (2 critical, 7 high, 2 moderate, 1 low; transitive severity is not proof of application exploitability). Evidence: hud-npm-audit.json. Includes Vite, ws, multipart and YAML parsers. Upstream Vite advisory https://github.com/vitejs/vite/security/advisories/GHSA-4w7w-66w2-5vf9 and ws advisory https://github.com/websockets/ws/security/advisories/GHSA-58qx-3vcg-4xpx consulted. Choose patched Vite 6.x retaining the project's Node 18-compatible toolchain, rather than jumping to Vite 8. Verify Node tests, builds and API/canvas browser flow; no persisted-data schema change.

### A124-008 — Medium — Declared test environments cannot run full coverage

Confirmed: n2n lacks chromadb (12 replication failures), unit lacks mcp/networkx and collides on unrelated top-level storage/topology_model/materials modules during shared-process collection (16 collection errors). Unit suites need per-file process isolation to match independently hosted plugins, not shared sys.modules. Add complete lightweight dependencies and keep optional heavyweight model tests explicitly separate. Evidence: n2n-baseline.json and unit-baseline.json.

### A124-009 — Medium — N2N regression harness is platform/runtime stale

Confirmed: cause signature test hardcodes Linux errno 111 and its automatic exception subclass, which differs on macOS. Gateway stall test stubs a CLI after production moved to persistent WebSocket RPC, so it attempted the local gateway (127.0.0.1:18789) rather than remaining offline. It failed connection; no agent turn completed. Mock the actual RPC boundary and use platform errno constants. Review double timeout in gateway.py/client.call before asserting approval-extension behavior is fixed.

### A124-010 — Medium — Mobile baseline blocked by generated package state

Flutter pub get/test/analyze encountered ephemeral/Packages/.packages cleanup errors. Tests were launched concurrently; first investigate shared Flutter generation contention and rerun serially before attributing this to source. No mobile source defect is yet confirmed.

### A124-011 — High — Gateway response timeout defeats approval-window extension

Confirmed by an offline delayed-RPC reproduction (gateway-timeout-before.txt): run_agent_turn extends its outer wait after on_stall, but GatewayWsClient independently times out using the original shorter deadline. Cancellation also leaves a pending RPC entry because _call_once only cleans TimeoutError, not cancellation/send failure. Fix: run_agent_turn owns its response deadline, cancels/awaits its pending task, and the RPC layer accepts no separate timeout for that caller with unconditional pending-map cleanup. Preserve the gateway's remote agent execution budget and idempotency key; response-wait extension does not authorize extra device writes or alter execution policy.

### A124-012 — Medium — Zabbix dependencies and checks drift from the supported runtime

Confirmed Mac baseline: dedicated install resolves FastMCP 4.0.10 despite supported 3.x, because the tracked wrapper has no upper constraint. The handshake probe treats its own inputSchema AttributeError as a skip, hiding failed verification. Isolation assertions assume the ambient interpreter has 2.x and all ignored external clones have old pins; neither assumption proves an install changed the host. Existing Mac interpreter reports 3.4.4, and was not modified by this audit. Keep dependency hazards in A124-005 visible, bound the supported dedicated runtime, assert actual virtualenv separation, and fail installed-server handshake errors. Evidence: zabbix-baseline.json.

## Remediation status checkpoint — Mac

| Finding | Current status | Evidence / remaining work |
|---|---|---|
| A124-001 | Implemented; HTTP/WS regressions pass | hud-access-before/after.txt; browser verification in progress |
| A124-002 | Fixed | token-budget-after.json; suite included in CI |
| A124-003 | Fixed and regression tested | gcf-loss-before/after.txt; full source snapshot preserved, scalar ambiguity falls back to JSON; savings benchmark pending |
| A124-004 | Fixed | Revert 503c595 removed astra-twin-mcp; no tracked implementation or registration. Removed stale claims; inventory-after.txt passes at 172 |
| A124-005 | Open | Ignored upstream clones have unbounded dependencies; no local third-party edits or exceptions used to hide failures |
| A124-006 | Skill corrected | Actual GAIT branch/record/log used; remaining example review pending |
| A124-007 | Patched; audit clean | hud-npm-audit-after.json: zero known vulnerabilities; tests/build pass; browser check pending |
| A124-008 | Fixed | unit-after-isolation.json: 235 passed, 2 skipped; runner-after.json: 19 passed; n2n-after.json: 474 passed |
| A124-009 | Fixed | Platform errno and RPC boundary tests pass in n2n-after.json |
| A124-010 | Resolved as test execution contention | Serial Flutter analyze clean and 421 tests pass. No app source fix needed |
| A124-011 | Fixed | n2n-after.json: delayed response, timeout and RPC cleanup tests pass |
| A124-012 | Fixed | zabbix-after.json: offline pass; missing live credentials remain explicit |

These statuses supersede the discovery-stage wording above. Passing existing tests is not completion of source/security review. All live/platform gaps remain open until exercised.

### A124-013 — High — RAG URL ingest mutates before rejecting scope consent

Source confirms _do_ingest_url invokes _ingest_fetched before checking include_linked scope token/HTML eligibility. A rejected request can already persist the first document. Move all scope validation before ingestion and test both invalid and valid tokens with a side-effect spy; preserve single-page workflow.

### A124-014 — Medium — RAG URL downloads bypass document byte cap

fetch() buffers the complete HTTP response before parse_file checks RAG_MAX_DOC_MB. Oversized or compressed responses can exhaust memory even during preview. Stream decoded response bytes under the same configured cap and stop early; test exact cap, over-cap without Content-Length, compressed decoded-size behavior and closure on failure. Internal documentation URLs remain supported; do not invent a public-only network policy.

### A124-015 — Medium — HUD uploads with identical names share one intake file

Source confirmed diskStorage uses original basename in a single intake directory, while asynchronous ingestion continues after HTTP 202. Concurrent uploads can overwrite each other's input. Pending reproduction/remediation; preserve original filenames while isolating upload staging and cleanup.

### A124-016 — Medium — RAG startup sweep queries chunks after deletion

Source confirmed interrupted-ingest sweep deletes Chroma document chunks before asking Chroma for IDs to remove from BM25. That query returns no IDs, leaving stale keyword-index entries. Pending focused regression and repair.

### A124-017 — Medium — Fifteen skills omit discovery frontmatter

Confirmed by direct file inspection and HUD parseSkills: missing name/description metadata yields empty discovery descriptions in the HUD and violates the skill file contract. Affected names listed in skill-mcp-static-summary.json. Add narrowly scoped descriptions matching existing workflows; this does not validate or authorize every action in the bodies. Semantic review remains separate.

### A124-018 — Critical — Twilio HTTP routes never enforce request authentication

Direct source review: validate_twilio_request is unused, chooses API secret rather than Twilio Auth Token, and allows missing credentials. Speech processing can dispatch agent work; alert trigger accepts arbitrary JSON without authentication. Callback routes need SDK signature verification before any state/work, and caller allowlisting for interactive callbacks. The JSON alert trigger needs a separate operator bearer token. A literal fallback gateway credential also exists in source; remove it and document rotation if used. Do not reproduce against a deployed service or emit its literal value. Primary Twilio guidance: https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-flask-app-by-validating-incoming-twilio-requests .

### A124-019 — High — Voice CML client disables certificate verification

Five CML HTTP clients hardcode verify=False, including credential exchange. Existing .env.example advertises CML_VERIFY_SSL=true but this server ignores it. Restore secure default with explicit operator lab override/CA configuration and regression tests.

## Second repair batch verification

- A124-001/007: real Chromium smoke passes HUD and canvas in dev and built preview, no page errors. Adversarial requests are denied through Vite too. Screenshots and script in evidence/hud-browser-*; synthetic service states mean no live chat claim.
- A124-013: baseline two failing consent tests; patched guards pass with zero ingest calls on rejection.
- A124-014: decoded streaming cap tests pass for exact limit, missing Content-Length and gzip responses. Limits bound accumulated content; parser/decompressor internal resource behavior remains part of further review.
- A124-015: per-request staging preserves identical original filenames and distinct content across simultaneous uploads. Tests cover cleanup, oversize failure and invalid configuration. Existing retained RAG sources are untouched.
- A124-016: persistent Chroma/BM25 regression fails before fix and passes afterward; startup now captures IDs before deleting Chroma chunks. Broader crash-atomicity review remains open.
- A124-017: fifteen metadata repairs pass skill-creator validator; structural rescan finds no missing frontmatter. No change to external-action authority.
- A124-018: enforced callback signatures, separate alert bearer token, allowlisted interactive callers, no literal gateway fallback. Seven security tests and three migration tests pass. Live Twilio/provider acceptance remains unverified. See docs/VOICE-SECURITY.md for adoption and shared-token rotation guidance.
- A124-019: verified TLS is the voice CML default; custom CA and explicit disposable-lab override tested. No CML endpoint contacted.

GAIT checkpoint: 915a7b83. No Git push or user-host replacement performed.

### A124-020 — Medium — RAG keyword cache uses unrestricted pickle loading

The BM25 cache stores only dictionaries/lists/strings, but loading it allows arbitrary Python global reconstruction. A tampered/imported cache can execute code when queried. No remote cache-write exploit is established; this is a confirmed unsafe-deserialization primitive, not a demonstrated remote RCE. Restrict unpickling to primitive data and validate the shape, preserving existing valid cache format without migration.

A124-020 verified: legacy primitive pickle cache is readable without rewriting, Python-global reducers are rejected before execution, and invalid corpus shapes fail without modifying the file. See rag-cache-after.txt and security-followup-tests.txt. No remote exploit established.

Narrow README rendering correction: Infrahub/Itential rows had six cells under a five-column header; setup variable names now remain visible in the function cells. Rendered excerpt inspected; comprehensive README phase remains pending.

### A124-021 — High (availability) — pyATS upstream transport changed without NetClaw migration

The installed clean external clone was 441fae3; upstream d497143 adds native `pyats.async_.pcall`, requires MCP SDK 2.x, and removes STDIO in favor of Streamable HTTP. NetClaw's installer clones/pulls this upstream while skill examples and `scripts/mcp-call.py` still invoke STDIO. An update can therefore break pyATS operations. This is a compatibility/availability defect, not an established security exploit.

Local clone fast-forwarded for explicitly requested CML acceptance. A private test venv overlays MCP 2.2.0 without replacing shared MCP 1.x. Test server binds loopback, explicitly uses stateless HTTP, and stops after checks. Native pCall tool discovery succeeds. The fleet skill now distinguishes process pCalls, threaded fan-out, and concurrent agent calls; it no longer presents obsolete STDIO examples. **Tracked installation, runtime launch, other pyATS skills, migration/rollback and regression tests remain open.** Do not treat this local clone update as a distributable fix.

### A124-022 — High — distributed iN2N listener is plaintext and proofs are relayable

Confirmed source: bgp-daemon-v2.py starts iN2N on 0.0.0.0 without SSL and its member dialer passes no SSL context. Enrollment tokens and delegated content cross the network in plaintext. Optional internal_channel SSL contexts skip certificate verification, while possession/hub proofs sign nonces without channel binding. A TLS-terminating relay can forward those proofs. Fix: loopback default, explicit certificate/key for non-loopback listener, verified TLS for remote dialing, reject non-loopback cleartext at the service boundary, and bind both proofs to the actual TLS channel. Distributed participants must upgrade together and configure trust; local loopback workflows remain supported. No claim that exploitation occurred.

### A124-023 — Medium — integration tests contact live services implicitly

Federation reachability probes run at test collection and can invoke a real member; UE5 live tests run unless explicitly skipped. Require explicit live opt-in, retaining offline tests. Missing integration dependencies and per-file plugin isolation prevented honest execution. Reproduced UE5 role inference error: generic `edge` router hint wins over explicit `fw`; short substring `er` also matches unrelated words. RAG integration failure is a stale schema-v1 assertion against migrated schema v2, not an ingestion regression. Reconciliation's missing-file fixture depends on an installed Junos clone and can fail first on unrelated dependencies; replace with a synthetic subprocess reproducing FileNotFoundError.

### A124-024 — Medium — Zoom RPC cancellation leaks pending entries; investigations unbounded

ZoomChannel.call registers a future before sending but only removes it on timeout/response. Send errors or caller cancellation retain it. Authenticated investigation requests create unbounded tasks and duplicate request IDs overwrite the delivery map. Repair with unconditional RPC cleanup, bounded in-flight admission, validated identifiers/text, duplicate refusal and task completion cleanup. Local shared-secret authentication and loopback binding remain required. No live meeting or external message used in verification.

### A124-025 — High — Zoom RTMS webhook does not authenticate lifecycle events

`mcp-servers/zoom-rtms-mcp/webhook.py` binds all interfaces and passes arbitrary POST bodies directly to meeting start/stop callbacks. `_validate_signature` only implements endpoint URL challenge response; it does not authenticate requests. Missing/negative/unbounded Content-Length also allows blocking or large reads. Fix before dispatch: Zoom HMAC-SHA256 over exact `v0:timestamp:raw-body`, constant-time compare, five-minute freshness window, configured-secret fail-closed, bounded body/read timeout and shape validation. Default listener loopback for local HTTPS reverse proxy. Reference: https://developers.zoom.us/docs/api/webhooks/ (verified 2026-09-26). Provider credentials are not used in tests.

### A124-026 — High — Zoom panel subscriptions trust arbitrary meeting identity

The panel WebSocket accepts an unsigned meeting_uuid and even discloses/selects the most recently active meeting for anonymous clients. An internet-facing panel proxy can therefore disclose network investigation results across meetings. Fix: require an authenticated, unexpired Zoom App context, decrypt with the configured app secret, validate issuer/audience/meeting/user, bind each socket to those identities, remove active-meeting fallback, enforce context expiry and clean registrations on disconnect. This intentionally removes standalone unauthenticated live access. Zoom SDK getAppContext supports Guest Mode; guest live acceptance still requires a real Zoom client. Primary references: https://developers.zoom.us/docs/zoom-apps/zoom-app-context/ and https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html#getAppContext .

## A124-027 — Direct RAG attachment ingestion bypasses staging safeguards

Confirmed: `_do_ingest_base64` decodes unbounded input and overwrites a shared filename before the parser enforces size limits. Concurrent uploads can ingest another request's contents and abandoned files accumulate. Fix with bounded strict decoding and private per-request temporary directories; retain normal source-copy semantics. Verification pending T063.

## A124-028 — Installer environment writes corrupt values and expose credentials

Confirmed: `_set_env_var` interpolates values into sed expressions and writes bare shell assignments. Ampersands/pipes/backslashes corrupt replacements; spaces and shell syntax change meaning when sourced; new files inherit permissive umask. Replace with atomic mode-0600 writes and literal shell quoting, rejecting line injection and symlinks. Existing unrelated assignments remain intact. No automatic rewriting of existing credential values.

## A124-029 — Mobile RPC failure paths retain requests and abandon sockets

Confirmed source paths: synchronous JSON/send failure leaves `_pending` entries, malformed peer messages and async handler exceptions escape the listener, explicit close leaves pending calls waiting for timeouts, and failed enrollment/reconnect handshakes do not close their new socket. Existing reconnect leak tests only mirror a swap rather than exercise EdgeClient. Repair actual lifecycle code and test it through an injected channel without native signing/network dependencies. No enrollment state migration or approval change.

## A124-030 — Redfish BMC identity is not verified by default

Confirmed: the client defaults to verify=False even when transmitting BMC credentials and reporting power/hardware health. Disclosure in result gaps does not prevent credential interception or forged operational data. Require certificate verification by default, support an operator-provided CA bundle for private/self-signed BMCs, and retain only an explicit disclosed lab override. Migration is breaking for untrusted self-signed HTTPS endpoints and must preserve credentials with preview/backup/restore.

## A124-031 — Failed RAG replacement destroys the last working document

Confirmed: same-title ingestion deletes the previous indexes, retained source and registry row before embedding the replacement. Explicit reindex also deletes the old record first. Missing models or another indexing failure therefore destroys working retrieval. Retain the prior ready record/source until replacement is fully indexed and finalized, then retire it; remove partial new indexes on failure. Confirmation remains required for explicit reindex.

## A124-032 — Built mobile companions have missing or stale release versions

Actual unsigned iOS Release artifact: Runner1.0.1(3), LiveActivityWidget1.0.0(1), NetClawWidget1.0(1), WatchApp missing both version keys, WatchComplication1.0.0(1). The build exits successfully despite this divergence. Share generated Flutter build name/number across targets and gate built bundles before export. Local distribution identity/profiles/API-key presence is verified; App Store Connect authentication/upload and latest remote build number are not yet verified. No upload or submission performed.

## A124-033 — Skill failure boilerplate falsely labels mutating operations read-only

Confirmed:100 skills contain the identical claim that all tools are read-only and a failed call has no side effects. EVE topology-build explicitly lists create/delete/connect operations, and affected skills also include configuration, cloud operations, messaging and incident workflows. A timeout after a completed write could trigger duplicate actions. Replace the blanket assertion with operation-specific retry guidance: confirm reads, inspect current state before retrying writes, preserve required approval and never infer rollback from an error.

## A124-034 — Three.js coordinate contract intermittently fails at layout bounds

The expanded unit suite exposed a nondeterministic existing failure: force-layout clipping returns integer bounds, and Vector3.to_list preserves them despite its float-vector contract. Cast serialized coordinates to float and test exact integer boundaries; preserve numeric positions and rendering.

## A124-035 — BM25 cache updates can corrupt or lose keyword entries

Confirmed: `_persist` truncates the live pickle before serializing/rebuilding, and concurrent read-modify-write operations use no lock. A failed write can destroy the previous readable cache; simultaneous additions can overwrite each other. Use mode-0600 temporary files plus fsync/atomic replace, build the new index before publication, and serialize operations within a store instance. Do not claim multi-process synchronization; one MCP owns this store.

## A124-036 — ANTA reports TLS verification without enforcing it; Nautobot defaults insecure

Confirmed against installed ANTA1.10 source: AsyncEOSDevice's `insecure` argument controls SSH host-key checking, not HTTPS eAPI verification. The wrapper passed `insecure=not verify_tls` but no SSLParameters, so eAPI still used verify=False even when output said tls_verified=true. Pass explicit certificate+hostname verification and require the supported SDK floor; close the per-request device in finally. Three first-party Nautobot clients and their registration default to verify=False. Change them to verified HTTPS with a private CA option. Explicit lab overrides remain available and documented; migration preserves credentials.

## A124-037 — Production write approval can be bypassed or never verified

Critical, source-confirmed: gNMI and Claroty `_check_servicenow_cr_state` are stubs returning None, while None and exceptions are accepted as valid. Their production gate therefore accepts any syntactically valid CR without checking ServiceNow. Fortinet/multivendor interpolate unchecked CR numbers into a ServiceNow encoded query and accept approval OR scheduled/implement state without requiring an exact returned record. Correct all four to reject unavailable verification, malformed numbers, mismatched records and non-Implement/unapproved states. Preserve explicit existing isolated-lab mode only where already supported; it is not production approval. Add real read-only verification for the two stubs and migration guidance/scripts. No CR creation or device write is part of these tests.

## A124-038 — Enabling write tools bypasses approval through raw run_command

Critical, confirmed: tools/raw.py chooses WRITE_ENABLED policy whenever MULTIVENDOR_WRITE_ENABLED is true. This enables arbitrary non-denylisted configuration through the nominal read-only run_command tool, bypassing apply_config's classification, CR, human approval and baseline gates. Keep raw commands read-only regardless of write-tool registration. Existing write users migrate to the gated apply_config workflow; no configuration state conversion.

## A124-039 — Multivendor device identity and baseline privacy are not enforced

Confirmed against installed Netmiko: connection defaults ssh_strict=False/system_host_keys=False automatically trust unknown host keys. Raw and configuration paths pass no override. NAPALM transports require explicit equivalent options, including PyEZ's host-key flag for Junos. Baselines/audit files also inherit permissive umask, and failed configuration sends can abandon a session. Require trusted host keys, preserve a clearly documented explicit lab exception, fail closed if a supported adapter cannot enforce verification, use private baseline writes, and guarantee disconnect after send failures. Read-only FRR acceptance initially passed under the old trust behavior; rerun with a key obtained directly from the owned container.

### A124-040 — High — GAIT setup destroys the working runtime before replacement succeeds

Confirmed: scripts/gait-venv-setup.sh removes the existing virtualenv before creating/installing/verifying its replacement, then forces a global --user --break-system-packages installation. A dependency/network failure loses the audit runtime. Replace with staged verified generation plus retained rollback and no global install.

### A124-041 — High — Installer bypasses its own Python isolation policy

Confirmed: core_prereqs exports PIP_BREAK_SYSTEM_PACKAGES=1 automatically, bypassing the new helper's PEP668 refusal. ComfyUI component invokes direct --user --break-system-packages installs outside shared constraints. Remove implicit override, route those installs through the constrained helper, and test the actual prerequisite path with synthetic tools.

### A124-042 — High — Analysis discovery misses denied symlink destinations inside broad roots

Confirmed in loader.discover: denied(full) checks the link name, while the realpath is checked only for root membership. With an explicitly broad extra root, a harmless-named symlink can expose a denied memory/RAG/credential dataset that remains inside that root. Apply the denied-path policy to both apparent and resolved paths before reading metadata/content; regress with synthetic memory fixture.

### A124-043 — High — Auvik pagination can forward credentials to a foreign origin

Confirmed: get_all follows response-supplied links.next as an absolute URL through an AsyncClient carrying HTTP Basic credentials. No origin guard exists. A malicious/compromised response can redirect a follow-up to another host, port or downgraded scheme with credentials. Restrict credential-bearing requests to the configured origin before transport dispatch; report partial pagination accurately on rejection.

### A124-044 — High — Memory/RAG GAIT hooks call nonexistent SDK APIs

Verified against installed gait-ai0.0.9: GaitRepo has neither open_cwd nor log_event. Both mutation hooks catch the error and continue, producing no GAIT record. Use discover/Turn.v0/record_turn, declare the dependency in each component runtime, and return explicit audit status/commit reference on mutations. An unavailable audit trail must be visible rather than implied successful.

Remediation checkpoint: A124-040–044 implemented and verified. GAIT staged runtime retains recovery; installer no longer silently overrides PEP668; analysis tests reject denied symlink destinations; Auvik origin tests reject credential forwarding; Memory/RAG actual SDK commit tests and unavailable-audit results pass (312unit tests plus offline integration). Evidence in verification.md.

### A124-045 — High — TCP syslog accepts unbounded buffering and handler tasks

Confirmed source paths: data_received appends indefinitely before a newline and creates one untracked task per line. The server also retains the placeholder peer address, collapses client counts and closes only the listening socket on stop. Bound frames, queued handlers and connected clients; retain actual peer identity and close/cancel receiver-owned resources.

### A124-046 — Medium — Telemetry audit endpoint is a silent placeholder

Syslog gait_logger._send_to_gait is a no-op while log_event returns success. This does not establish an immutable GAIT trail despite documentation claims. Disposition/remediation remains open; ordinary Python logging is not equivalent to GAIT persistence. Review copied receiver implementations before repair.

A124-046 implemented: the three receivers now persist bounded local GAIT batches, expose pending/persisted/error counters and commit references, and flush on normal shutdown. Seven tests pass using actual temporary SDK repositories plus deterministic overload/failure fixtures. Additive local store; no pre-existing GAIT data existed to migrate, and ordinary logs are preserved. Native Windows is not supported by the POSIX file lock; required macOS/Linux/WSL hosts are supported.

### A124-047 — High — UDP telemetry creates unbounded handler tasks before rate limiting

All three UDPReceiverProtocol.datagram_received methods create an untracked asyncio task for every datagram. The downstream token bucket does not bound tasks waiting for dispatch. Receiver stop closes the transport but leaves these tasks running. Bound admission before task creation, expose drops separately from parser errors, and own cancellation/join on stop. No state migration; overload already drops telemetry at the downstream rate limiter, and this moves admission to the resource boundary.

### A124-048 — High — All three telemetry MCP launch commands fail before handshake

Reproduced by running each *_mcp_server.py with the declared Python runtime: ImportError, attempted relative import with no known parent package. The registration discovery script selects these files directly; the README's standalone -m module invocation also lacks package context. Establish an isolated package namespace for direct/module entry points and add real stdio MCP initialize/list/status tests in a declared telemetry suite.

### A124-049 — High — Contract preparation deletes unowned directories and working runtimes

prepare_suite removes environment.path with shutil.rmtree before creating its replacement, without requiring an ownership marker. _inside_repo accepts the repository root and source directories. Current ANTA/multivendor/Zabbix paths can coincide with operator runtimes. Refuse unsafe/symlink/unowned destinations before changes, validate marker ownership, and retain a managed runtime until replacement succeeds, restoring it on preparation failure.

### A124-050 — Medium — Environment migration restore can overwrite later unrelated edits

The new environment migration scripts restore the entire saved file without checking whether another migration or user edit changed it afterwards. In a multi-step upgrade, restoring an older backup can silently revert newer credentials/settings. Add a private digest journal at apply time and require restore input to match the recorded post-migration state (or unchanged original backup). Legacy backups without a journal require manual comparison; never infer that subsequent edits are disposable.

### A124-051 — High — HUD renders peer/tool/chat content as active HTML

Confirmed in src/main.js: addChatMessage concatenates assistant text directly into innerHTML; federation chat interpolates peer replies and names; terminal cards interpolate tool output. Numerous detail/panel renderers interpolate external metadata into HTML attributes. A malicious peer/model/tool response can execute script in the privileged local HUD origin. Sanitize at every HTML insertion sink, preserve supported UI controls and text formatting, and strip active markup, network-loading attributes and unsafe inline styles. Test adversarial text/attribute/SVG/protocol payloads and normal formatting/controls.

### A124-052 — High — HUD configuration writes corrupt literal values and expose/truncate sensitive files

HUD writeEnvFile interpolates keys/values into raw dotenv lines and writes directly with default permissions. Newlines can create unintended assignments; quoted values from the hardened Python writer are not decoded by the HUD reader. Testbed and budget/config writes likewise overwrite directly, without restrictive creation or symlink refusal. Use validated literal dotenv encoding/decoding and a shared private atomic writer; preserve unrelated settings and old contents on failure. Provide an explicit permissions preflight/apply utility for existing sensitive files.

### A124-053 — High — Federation/edge RPC cleanup misses send failure, cancellation and close

Both transport call methods insert a pending future before send but clean it only on response or response timeout. Send failure/caller cancellation leaves entries behind; federation close never settles pending calls. Edge close can cancel its own reader while awaiting WebSocket shutdown, skipping pending cleanup. Use a single send+response deadline and unconditional pending cleanup, reject closed channels and settle pending calls on close without cancelling the currently executing cleanup task. No wire/schema migration is required.

### A124-054 — High — Federation dispatch creates unbounded concurrent tasks

FederationChannel._dispatch_task creates a task for every reassembled frame with no task-count or aggregate-byte admission limit. Per-frame bounds do not prevent a peer opening enough slow requests to exhaust memory, and per-channel limits alone would be bypassed by reconnecting. Bound dispatch tasks and retained raw-message bytes across channels in the process. Reject excess work before task creation and close the overloaded transport; already-authorized work retains its normal completion semantics and is not automatically retried.

### A124-055 — Medium — HUD RAG fails in a checkout path containing spaces

The server interpolated its absolute RAG script path into an unquoted command string. mcp-call.py uses shlex.split, so a path such as `/Users/operator/NetClaw Project/...` becomes multiple arguments and the RAG server cannot start. Quote argv items for that parser without invoking a shell; actual parser regressions cover spaces, quotes and metacharacters. No persisted schema changes or migration.

### A124-075 — High — Installer skill deployment overwrites operator content and follows links

`core_deploy` uses recursive copy into an existing tree, then rewrites all deployed text for alternate runtimes. Existing skill edits have no recovery copy; destination symlinks may redirect writes outside the skills directory. Preserve changed existing files before atomic replacement, refuse link destinations before any write, and transform incoming managed content only. Add explicit conflict-aware restore of retained originals; custom-only files remain untouched.

A124-075 verified: original installer overwrote a synthetic operator skill without backup (`skill-deployment-before.json`). Seven regressions pass for actual deployment, private backups, repeat behavior, custom-only preservation, runtime substitution, directory/file symlink refusal, failed replacement and conflict-aware repeat restore (`skill-deployment-after.txt`). No operator installation was modified.

### A124-076 — Medium — Edge queue replays messages past its TTL

Expiry is pruned only on enqueue; a disconnected phone can reconnect after the seven-day TTL without a new write and receive expired messages. Read/count operations must exclude expired rows independently of enqueue. This preserves stored rows until normal pruning while preventing stale replay; no schema migration.

### A124-077 — Medium — Invalid pricing and NaN cost bypass budget comparisons

Pricing override JSON is assumed to be a model mapping and accepts arbitrary price/discount values. Arrays crash loading; NaN cost can enter SessionLedger.total_cost, making cost-cap comparisons false. Validate overrides and reject invalid ledger costs while halting further budgeted work. This is configuration/usage validation; no historical price or provider billing equivalence is asserted.

### A124-078 — Medium — Fortinet malformed RPC response appears as no ADOMs

An HTTP200 body missing result/status.code defaults to success and returns None. list_adoms turns that into empty_result. Non-auth errors also use an empty-result outcome before scope validation obscures it. Require a well-formed single RPC result with explicit status code; expose request_failed for invalid/error responses and retain valid empty-list semantics.

### A124-079 — Medium — Fractional BGP rate limit crashes before request

BGP_INTEL_MAX_RPS accepts positive fractions but int conversion in the sliding window turns values below1 into capacity0; recent[0] raises IndexError. Preserve operator-requested slower rates with one slot per1/rate seconds below1rps; retain the existing integer sliding-window ceiling above1.

### A124-080 — High — Production model guard accepts disabled/direct-provider execution

`defenseclaw_available` checks CLI presence and an open TCP port but never checks security_mode, despite its contract. Border startup only logs require_defenseclaw_mode failure. Embedded execution preserves a direct --model override after this proxy-only check; member-home provisioning explicitly creates a direct Anthropic provider. Require configured guard mode and effective model routing through the intended local proxy, including overrides/fallbacks, before production delegation. Testing mode remains explicitly unguarded. Existing production deployments using direct member providers need manual reviewed configuration adoption; do not rewrite operator provider credentials automatically.

### A124-081 — High — Invocation authorization goes stale while awaiting approval

Tools/skills/knowledge/replication authorize before an approval wait and then execute without checking revocation, federation state or consumed budget. Skill requests debit only after execution, allowing concurrent starts beyond the remaining daily allowance; replica reads do not debit requests. Revalidate the same original grant at admission and reserve each request before execution. Human approval cannot resurrect a revoked/replaced grant. Already admitted work is not retroactively cancelled.

### A124-082 — High — Setup evaluates credential input and alternate-runtime writes lose literal/private guarantees

setup.sh prompt helpers eval user input; set_env still uses sed/unquoted dotenv despite the installer writer repair. Hermes conversion strips quotes without decoding escaped literal values and writes credential-bearing YAML/sidecars with ordinary permissions; normalizer writes config in place. Share the literal codec and private atomic writer, and use printf assignment rather than eval. Preserve existing configuration during write failure; no credential-value logging.

### A124-083 — Medium — Malformed vendor inventories become successful empty lists

Claroty logs an unrecognized response then returns[]; Halo non-JSON GET is wrapped as successful raw text then pagination extracts[]; Auvik missing data defaults to[]. All can be misread as an empty inventory. Reject unrecognized list shapes and preserve accumulated items with explicit error/truncated metadata where the client envelope supports partial results. Valid empty list replies stay successful.

### A124-084 — Medium — Platform setup overwrites identity and voice policy

Personalization replaces USER.md even on a repeat setup (default role is nonempty). Twilio setup interpolates a label into JSON without escaping and replaces all existing whitelist/quiet-hours/rate settings. Preserve operator text and unrelated voice policy, retain originals privately before updates, and serialize labels as JSON data. Reject malformed existing state rather than rebuilding over it.

### A124-085 — High — Peer-chosen result ids overwrite earlier audit/task payloads

Auditor.store_result derives a shared filename from request_id and overwrites it. Distinct peers/calls choosing the same id can corrupt an earlier result reference. Write failure is logged but still returns a nonexistent reference, allowing completed-state claims without stored output. Use unique private files independent of peer-controlled ids; propagate persistence failure and ensure task terminal failure remains visible even when error-payload storage also fails. Existing stored references remain readable.

### A124-086 — Medium — Azure ordinary logs are labeled GAIT records

The Azure wrapper only calls logger.info but labels entries GAIT. It also logs success whenever a function returns, including returned error envelopes. Correct the logging/documentation claim: these are ordinary operation logs, not persisted GAIT commits. Mark normal returns as returned; session workflows retain the separate GAIT obligation. This correction does not invent server-side GAIT persistence.

### A124-087 — Medium — Clean mobile CI lacks SwiftPM plugin source directory

PR265 mobile CI selected Flutter3.47.5 instead of the locally verified3.44.8, changed four locked dependencies and failed copying firebase_messaging into an absent SourcePackages directory. Pinning3.44.8 removes dependency drift but run36323404710 reproduces the same missing-parent failure, so SDK drift was not the root cause. Create build/ios/SourcePackages before pub get and run the complete macOS job; workflow-only changes must also trigger that job. Native build acceptance remains pending until CI succeeds.

### A124-088 — High — Standalone setup bypasses credential and preservation fixes

CheckPoint/IPFabric/Forward retain delimiter-based or raw dotenv writes; peering prompts evaluate input, and dotenv launch loses spaces/quotes. Twitter/Twilio standalone scripts duplicate unsafe credential writes, and Twilio replaces the whitelist policy. OAuth setup prints tokens and overwrites dotenv without private atomic persistence. IPFabric also references an undefined writer variable. Extend the shared safe writer and profile updater across these entrypoints; retain private configuration recovery and explicit failure.

### A124-089 — High — OAuth callback does not bind returned authorization to request

Twitter setup generates state but accepts any code on any URL without validating state, and waits indefinitely for callback/provider response. Four loopback negative cases reproduce acceptance. Require one matching state and callback path/code, bound waits and close the listener. Persist tokens privately with literal encoding and no credential logging; no live Twitter authorization is performed in the audit.

### A124-090 — High — Empty or unresolved TLS settings disable server identity checks

Several startup expressions enable TLS verification only for recognized true values, so blank/unresolved/typo environment values silently disable it.22 regression cases reproduce this plus old insecure CML/Redfish registration defaults. Zabbix has the same parser issue upstream; contain it in a first-party launcher without modifying the vendored source. Existing production deployments must adopt corrected registration and trust their private CA; intentional lab overrides remain explicit.

### A124-091 — High — ANTA keyword reclassification hides real failures

Any message containing inactive, not configured or unsupported becomes not_applicable, including inactive interfaces, missing expected BGP peers, unsupported hardware and mixed failures. Six fixtures reproduce lost failure verdicts. Reclassify only complete recognized command-unavailable diagnostics and only when every message qualifies; uncertain/mixed expectations remain failed.

### A124-092 — Medium — Redfish transition states are reported as completed power facts

PoweringOff becomes POWERED_OFF and PoweringOn becomes POWERED_ON, asserting a stable state before the BMC reports completion. Preserve transitions as distinct POWERING_OFF/POWERING_ON with an explicit completion caveat. On/Off behavior remains unchanged; consumers of the closed enum must accept the additive values.

### A124-093 — High — Chat sessions are unbound and transcripts allow path escape

Chat message handling never verifies session existence, owner or direction. Peer-supplied ids are interpolated into transcript filenames, and duplicate opens silently reuse another peer’s row. Transcript errors are swallowed; symlinks can redirect writes. Concurrent messages debit request allowance only after gateway completion. Bind sessions before execution, constrain ids/paths, surface persistence failures and reserve budget before awaiting the model.

### A124-094 — High — Certificate renewal reports unchanged credentials as renewed and retires active keys

Create-once CA/hub helpers and no-op ACME renewal can return the original certificate. Rotation registers it and retires the same fingerprint, falsely reporting success and removing it from the active registry. A real renewal retaining its key suffers the same retirement. Require a different valid certificate and retain same-key successors as active. Unsupported CA/hub renewal now needs explicit operator attention rather than a false success; peer successor rollout remains a separate review.

### A124-095 — High — Timed-out or cancelled ACME commands continue running

The ACME wrapper cancels communicate on timeout/cancellation but never terminates or reaps the process. The command can continue after its caller fails. Two real subprocess cases reproduce the surviving child. Terminate the owned process group and reap before returning failure; preserve normal exit/output behavior.

### A124-096 — High — Automatic certificate renewal breaks established peer pins

Host renewal generates a new key, then sends an unacknowledged n2n/cert/update notification for which no handler exists. A remote authoritative file pin rejects the renewed host, although rotation reports success. Renew the certificate using the installed key and preserve pin identity; refuse registry/key inconsistency before writes. Remove claims of automatic successor-key overlap. Deliberate key replacement requires the existing operator verification/re-pin workflow.

### A124-097 — High — Inventory advertisement bypasses visibility and escaped-secret checks

Member aggregate skills bypass per-peer visibility. Secret scanning compares raw dotenv text against JSON-escaped output, missing quoted, backslashed and Unicode credentials. Remote cache filenames accept path components; absent metadata incorrectly reports fresh and UTC timestamps are parsed in local time. Eight initial regressions reproduce these boundaries. Filter aggregate capabilities, decode configured/effective secrets and compare decoded strings, constrain cache filenames and refuse links, persist privately/atomically and fail stale on missing/invalid/future timestamps.

### A124-098 — High — Failed replication overwrites or unregisters a retained replica

Repeated start writes directly into the stable vector collection and deletes it on failure; resync deletes registry rows before vector promotion, losing the prior registry if promotion fails. Two real Chroma/SQLite cases reproduce data loss. Stage every transfer, reject duplicate/oversized/misaligned pages before writes, prepare pending registry rows and publish them transactionally only after vector promotion. Retain the old vector generation until the registry callback succeeds and restore it on callback failure. Multi-store abrupt-process recovery remains an explicit operator inspection boundary, not a distributed atomicity claim.

### A124-099 — High — Optional GRE lab scripts mutate unrelated host networking

Lab setup adds IPv4 addresses to every bridge, including unrelated host networks; teardown removes routes by destination without constraining the lab interface. Remove the global workaround and constrain route removal to gre-netclaw. Correct the stale IPv4 README to the actual IPv6 fixture and document disposable-host/reserved-resource prerequisites. Command-recorder execution verifies scope without host network changes. Verification also now recognizes OpenConfirm as non-established, handles zero OSPF neighbors without malformed numeric input, and queries IPv6 tunnels correctly.

### A124-100 — High — Canvas session changes lose or misattribute conversation state

Async replies append by node id while sessions reuse root/numeric ids. Session switches can redirect completion into another conversation; save/delete failures are swallowed, and deleting the active session calls newSession which saves the deleted record again. Serialize request/session-change admission, show storage/busy errors, retain current session on failed save/delete, reset a deleted session without saving it, clear per-session drafts and cancel pending autosave on effect cleanup. Production-handler fixtures reproduce all three persistence defects; asynchronous gate tests exercise both directions of admission.

### A124-101 — Medium — Zoom overlay toggle claims success before an available/successful implementation

Panel changes enabled state before checking whether the optional overlay module exists or whether SDK calls succeed. The shipped HTML does not load overlay.js, yet the button reports enabled. Refuse unavailable/failed changes, update state only after an explicit true result, serialize button actions and clean up a controller after failed camera startup. Stop attempts cover both layers, retaining failure visibility. The optional module remains unloaded pending real Zoom Layers entitlement/API acceptance; no live overlay success is claimed.

### A124-102 — High — Device deep links inject arbitrary text into automatically submitted requests

Device URI parsing accepts any decoded first path segment and ignores user info, ports, query/fragment and extra segments. A QR/link can contain encoded newlines and instructions that become an automatically submitted agent prompt. Reproduction reaches ask() with such a link. Restrict the device route to one bounded ASCII inventory identifier, reject extra URI fields and retain normal known/unknown identifier behavior. This narrows untrusted identifier syntax; it does not replace server authorization or claim to solve arbitrary prompt injection.

### A124-103 — High — Mobile lifecycle paths retain clients after their owner exits

EnrollmentGate drops a late reconnect result after disposal without closing it. HomeShell stops its supervisor but does not close its client or unsubscribe deep-link/push listeners, allowing old handlers to survive removal. Background refresh uses an unowned timed-out reconnect and skips close on intermediate errors, and its native setup repeats the independent-engine/full-plugin pattern already corrected for App Intents. Reproduce and close all owned clients/listeners, reuse bounded connection ownership and selective grouped native startup. Native runtime behavior remains distinct from simulator compilation.
