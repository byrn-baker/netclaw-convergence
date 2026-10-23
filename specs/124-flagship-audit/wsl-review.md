# WSL continuation boundary review

This is incremental evidence, not a declaration that all pending baseline files
were semantically reviewed. Test execution and source review remain separate.

## Installer and CI

Read the real install CLI control flow, common path/environment helpers,
component pyATS/GAIT installers, core deployment, token dependencies, pip helper,
GAIT generation setup, pyATS launcher/environment migration and service templates.
Found and reproduced A124-056/057/061 at actual deployment/CLI boundaries.
Shared constraints still apply only to the legacy runtime; pyATS MCP2 is isolated.
Reviewed all four GitHub workflows: PR-triggered tests do not execute under
pull_request_target; skill review has PR-write permission and a pinned action;
HUD tests/build and manifest-selected Python suites are gates. Mobile uses its
Mac runner and serial commands. Floating action tags remain a supply-chain
limitation, not evidence that code from an untrusted PR receives secrets.

Installer continuation reproduced failed in-place pyATS replacement (A124-064).
Staged source/venv adoption now passes real WSL inventory, preview/repeat/restore
and restored-runtime imports. Debian systemd fresh install, repeat upgrade and
managed pyATS adoption passed; four operator fixture hashes survived. GAIT
rebuild/repeat/restore/imports passed. A real distro Python install is refused by
PEP668. systemd restart required readiness polling: immediate health was false,
then authenticated health became true; process-active alone is not readiness.
N2N component/CLI literal writes and required-dependency failure now have actual
shell regressions (A124-067/061); systemd parses metacharacters, quotes and tabs
correctly. Broader component-specific upgrade/recovery review is still open.

## HUD

Reviewed access middleware, Vite dev/preview configuration, gateway chat dispatch,
HUD form submission and Canvas composer. Actual Windows Edge over WSL loopback
passed HTTP, WebSocket and both UI chat submissions using an isolated synthetic
gateway; no browser JavaScript errors. Canvas Markdown correctly interprets
underscores as emphasis, so acceptance uses a plain-text marker. This was a test
assertion correction, not an application failure. A separate real-provider gateway request returned the exact expected marker.
This provider check is distinct from browser fixture submission. Previous Mac malicious-HTML evidence is retained.

## RAG, memory and token boundaries

Reviewed RAG configuration, embedder lazy loading, parser input/page caps, chunking,
scrubber, hybrid fusion/post-filtering, reranker and Chroma storage/replica promotion.
Confirmed A124-058 plaintext credential leak, A124-060 false-empty storage failure,
and A124-062 destructive promotion failure; each has reproduction and regressions.
The apparent missing BM25 metadata filter is applied by _do_search after fusion;
it is not a demonstrated scope bypass. Metadata filters may reduce recall because
candidate depth is bounded before post-filtering; no completeness claim is made.

Read memory storage validation, parametrized SQL/graph traversal and semantic
search envelopes, plus token policy/ledger/counter/pricing/footer/wrapper paths.
Memory date/topic filtering and false-success errors reproduced against actual
Chroma (A124-066); regressions now cover existing metadata and partial candidate
retrieval. Explicit errors replace false empty success. Token estimates are labelled; configured/default model prices
are estimates, not independently verified current provider billing. Budget input
validation reproduced a NaN ceiling bypass (A124-065); invalid overrides now retain
the last valid layer, with explicit boolean parsing and negative tests. RAG real-model
quality and mobile real-device behavior remain outside these offline checks.

## Fixture boundary

Docker initially named a WSL-local daemon and later Docker Desktop; fixture tests
were rerun against the latter. Existing containers and occupied port 8000 were
preserved. Redfish uses a dedicated loopback port and an official digest. FRR
accepts the Docker-obtained trusted public key and refuses unknown/mismatched keys.
NSM ran 19 checks with zero skips; a timed-out daemon preflight was separately
reported and rerun rather than treated as a failed engine test.

Linux acceptance uses a dedicated privileged systemd container with no host
filesystem or Docker socket mounts. Privilege enables its isolated init/cgroup
service manager. This validates Debian userspace and real user systemd services
on Docker's shared kernel, not a separate bare-metal kernel or a Mac installation.

## Federation and mobile continuation

Read service peer consent/hello/TOFU/TLS admission, edge enrollment/reconnect,
restricted method dispatch, approval resolution and risk-wide approval listing;
read the authorizer's grants, request/token budgets and approval lifecycle.
Found unavailable-role fail-open (A124-068) and expiry ignored at resolution/list
(A124-069), with actual service/SQLite regressions. Self-asserted peers remain
presence-only under the explicit tier policy. Edge approvals intentionally trust
an enrolled phone's confirmation report; this is not remote biometric attestation.
The documented single-approver-per-risk model is not per-user approval isolation.

Read mobile QR parsing/domain check, enrollment persistence, hardware identity
bridge and iOS Secure Enclave key generation/signing, confirmation helper,
headless reconnect, capture size admission, app lock, watch relay and watch
ApprovalsView plus Live Activity deep-link entry. No bad-certificate override was
found in the Dart/Swift sources. Watch decisions perform fresh local authentication;
Live Activity buttons open the approval screen. Headless late-connect ownership
is A124-070. Hardware identity and watch confirmation still require actual devices;
Flutter fixtures cannot establish those platform guarantees.

## Additional MCP boundary sampling

Document guards require attributed value/unavailable/failed shapes; Office images
resolve inside workspace output, outputs reserve unique names, and spreadsheets
force string cell types. These checks do not validate the factual truth of supplied
attribution. Halo uses explicit preview then submit, bounded page count and partial
error envelopes, verifies TLS by default, and does not retry the ticket POST.
Azure client selection uses SDK credential chains, fixed Azure scopes and a
subscription semaphore; pagination errors propagate. Blender's bundled addon is a
trusted local code-execution endpoint by design, default localhost; inspection is
not a Blender/Windows rendering acceptance. Broad vendor/skill review remains open.

## Skill continuation

Read ACI change deployment, Aruba CX configuration, Cloudflare DNS and Atlassian
ITSM workflows. Cloudflare examples are reads and identify their remote server;
Atlassian mutating flows retain human confirmation. Aruba's upstream ITSM toggle
and lab mode are described, not independently verified enforcement. Installed
external schemas must be discovered before invoking them. ACI's OR approval gate
was incorrect (A124-072); it now requires exact-CR approval AND Implement state.
Eighteen GAIT calls across17 skills used ignored nested-input or prompt/response fields (A124-071).
Actual GAIT accepted the probe but stored empty text; the probe and corrective
explanation are retained. Corrected examples preserve their illustrative content
and explicitly prohibit treating sample outcomes as observations. All literal GAIT
examples are checked against the installed signature and actual stored fields.
This adds targeted caller review, not full semantic coverage of those17 skills.

Additional HUD review covered local API environment masking/updates, budget config
and status, skill markdown resolution, session transcript extraction and chat
forwarding. Encoded identifiers and outside symlinks escaped skill/session roots
(A124-073); actual HTTP fixtures now reject them. Zero ceilings displayed default
limits (A124-074); shared display validation now preserves zero and invalid-layer
fallback. The cost display is still an estimate, not independently verified billing.
Federation cold-start shell execution uses the operator-stored launch specification;
it is not directly constructed from peer request text. Production selects confined
argv and refuses unavailable containment; this is distinct from lab shell execution.

A124-075: reviewed core_deploy skill copy and global alternate-runtime rewrite; reproduced lost custom skill in the prior committed implementation. Replaced with retained-original deployment and incoming-only substitution. Seven fixture regressions passed. All targets are preflighted before writes, but whole-tree replacement is not transactional; recovery checks digests and refuses later edits. Strict symlink refusal includes ancestor paths.

Reviewed edge_queue.py enqueue/prune/replay/counts: found expiry depended on future enqueue, reproduced with real SQLite then repaired all pending reads/counts (A124-076). Reviewed logfilter.py narrow asyncio message suppression and malformed-record pass-through. Reviewed transport_health.py: systemctl/DNS checks are coarse local service/peer-host diagnostics, not authenticated tunnel reachability; absence of systemctl returns false and no native Mac tunnel proof is claimed.

Token package remainder: cost calculator override shape/finite-range and session ledger NaN admission produced A124-077. Counter fallback explicitly marks estimated and omits nontext payload sizing; GCF wrapper preserves JSON/string fallback and calls reviewed serializer, binary wrapping is a display conversion rather than binary archival. Analysis sandbox materializes allowlisted datasets before external-access/configuration lockdown; serial query watchdog interrupts and output caps expose truncation. No hard OS-level CPU/RSS isolation claim.

Fortinet REST/JSON-RPC transport and credentials: TLS defaults verified, credentials named not emitted, no automatic write retries. RPC malformed-success reproduced/fixed078. The local JSONL audit is ordinary logging, not an immutable GAIT commit; retain that boundary. BGP HTTP caching/rate control and private-prefix validator read: cache TTL/source labels and input refusal are explicit,0.5rps crash reproduced/fixed079 with observed timeline. No live registry/appliance requests for these regressions.

160 baseline paths received explicit coverage dispositions supported by completed HUD/Flutter execution, source reads, AST-empty package markers or historical/passive artifact boundaries. The inventory and hashes are in evidence/wsl/coverage-dispositions.json. Historical blog/archive drafts do not assert current platform or provider acceptance. Remaining pending paths stay pending.

Reviewed router/controls/posture plus embedded model selection and member-home provisioning. Router excludes removed/quarantined members and deterministic specialization is explicit. Production guard incorrectly used proxy reachability without config/override routing, reproduced080. Corrected guard checks use effective config and inherit conservative fallback checks; target tests cover disabled mode/direct provider/fallback/remote endpoint/agent override and valid local route. Probe liveness does not certify external guard decisions. Additional invocation review is active: grants/budgets are checked before approval waits, and skill request debit occurs after execution; revalidation/reservation regression is next.

A124-081: full invocation tool/task/query/replica admission and Authorizer review
confirmed stale authorization after approval/guard waits, late skill debit and
missing replica debit. Added revalidation of original grant, federation and
knowledge visibility; conditional SQLite request reservation prevents concurrent
starts beyond the daily allowance.16 targeted tests and full n2n suite pass.
No claim of retroactive cancellation or hard token reservation for unknown future
model usage.

A124-082: actual setup helpers execute substitution-looking input via eval and
sed fails on delimiters; fixtures reproduce both. Hermes legacy decoder fails
literal round-trip and new YAML mode was0644. Shared private writer and decoder
now used by setup/Hermes/cwd normalizer;16 writer/CLI/deployment tests pass.
Remaining setup review candidates: Twilio JSON heredoc string escaping and
unconditional USER.md personalization replacement; not yet dispositioned.

Vendor AST boundary inventory reviewed for Azure/Auvik/Claroty/Halo tool wrappers:
Azure SDK get/list/read diagnostics, Auvik inventory GETs, Halo read tools plus
previously reviewed gated CR creation, Claroty read POSTs and ITSM-gated writes.
Claroty retries only429, not generic write transport errors. Actual list parsing
review confirmed083 missing/malformed wrappers become empty; fixed with valid
empty and partial-page tests. Halo explicit record_count0 metadata retained.
This extraction is not full semantic certification of all formatter/compliance
logic or live cloud/appliance endpoints.

Setup remainder: testbed editing is explicitly handed to the selected editor;
no device commands execute in setup. Identity and Twilio heredocs confirmed084
original-data replacement and malformed quoted-label JSON. Added private
retained-original updates, managed identity section and policy-preserving voice
merge;4helper tests plus actual prompt literal test pass. No real voice/provider
calls or operator profile modifications were performed.

A124-085: Auditor result ids were peer-controlled shared filenames; repeated ids
overwrite prior payloads and failed writes returned false references. Exclusive
0600 files now decouple payload identity from request ids. Task persistence failure
reaches failed state even if the error payload also cannot be saved. Missing and
legacy result references tested explicitly;4 tests and full n2n pass.

A124-083 name-resolution follow-through: Halo/Auvik resolvers previously converted
failed or truncated lists into NotFound or an apparently unique match. They now
return UpstreamError while explicit numeric ids retain direct lookup.5 fixture
cases pass, and full Halo/Auvik suites pass after correcting the legacy
false-empty assertions. Explicit Halo count0 metadata remains a valid empty reply.

A124-086: Azure source wrapper was ordinary logger.info labeled GAIT, not immutable
persistence. Corrected function/log/documentation names and normal-return status;
registered MCP tool names are unchanged. AST compilation succeeds. Session GAIT
recording remains required separately; no new server-side persistence claim.

### Standalone setup and OAuth continuation (088–089; T128–130)

Read credential/setup paths of CheckPoint, Forward, IPFabric, Twitter, Twilio, peering and cert patching. Corrected literal dotenv updates, peer prompt evaluation and selected-key process env, preserved Twilio policy and CheckPoint config originals, and stopped required dependency/build/smoke failures. Twitter/Twilio use the existing PEP668-safe interpreter helper. OAuth now binds callback path/state/code, bounds wait and token exchange, and saves token pairs in one private atomic write without printing credentials. Twenty isolated actual helper/full-script/loopback tests pass, including four rejected OAuth callbacks. The unit family also passes after the initial batch; later CheckPoint/Forward cases are in the20-test targeted result. No provider authorization, live calls/posts, certificate migration or mesh launch occurred against operator state.

Contract test dispositions added only for actual passing harnesses and explicit non-live files named by them, plus loaded Auvik/Halo/N2N pytest configuration. Opt-in live suites remain pending/source-review candidates; running an offline harness does not validate their providers. Exact paths/hashes/methods are in evidence/wsl/coverage-batch89.json.

Mac CI now reaches native build: after creating the SwiftPM parent, analysis and431 Flutter tests pass on macOS. Xcode15.4 aborts loading synchronized groups; the next run uses macos-26/Xcode26.6 and SDK-relative Foundation lookup. This is still pending native-build acceptance.

### Controller and adopted-server boundaries (090)

Reviewed CATC facade source end-to-end: fixed groups/operation catalogue, GET-only dispatch, credential token acquisition, controller identity/time caveats, explicit empty/auth/forbidden/error outcomes and bounded HTTP calls. Parsed all8 catalogue files:514 GET definitions, relative URI paths; these are generated upstream definitions, not native executable server code. Appliance/version compatibility remains external and live CATC acceptance is not claimed.

Read K8s/Zabbix notices and guides, actual registration, K8s denied Secret/read-only/core tool config, and Zabbix read-method/deny-list/TLS/client initialization boundaries. Zabbix remains an unchanged adopted dependency; remaining vendor files receive an explicit external boundary, not first-party source certification. Its boolean parser exposed the unresolved TLS defect090, contained by the first-party launcher and covered against the actual vendor parser. Read-only operations still require session GAIT; corrected documentation that implied there was nothing to record. Exact paths/hashes are in coverage-batch90.json.

Expanded TLS startup-expression review across CATC/GNS3/EVE/Auvik/Halo/SuzieQ/Claroty and current CML/Redfish registration defaults.66 targeted tests pass including legacy registration preview/apply/repeat/recovery, later-edit conflict and custom launcher refusal. No upstream source changed and no provider traffic occurred. Runtime-specific CA acceptance remains dependent on actual configured provider access.

### Memory/GCF review closure and verdict follow-through

The remaining memory files are now reviewed: schema has idempotent tables/indexes and temporal fact keys; package initializers only export storage/embedder classes; embedder lazily loads a fixed model, latches unavailability and returns None for embedding failure, while the already-repaired Chroma store exposes EMBEDDING_FAILED/CHROMA_UNAVAILABLE instead of an empty success. Model retrieval quality and cache/download availability are outside offline certification. The token library manifest pins gcf-python2.2.1; Anthropic remains a lower-bounded SDK dependency, with shared installation constraints and current tested runtime recorded separately. No new dependency added. Together with prior RAG replication/recovery/GCF/budget reviews and benchmarks, this completes T010's targeted review scope; other broad tasks remain open.

ANTA verdict review found substring matches reclassify real and mixed failures as not_applicable (091). Redfish verdict review found transition states asserted as completed power facts (092). Twelve regressions pass after narrow whole-diagnostic/all-message classification and distinct POWERING_ON/OFF outcomes. Full ANTA/Redfish contract follow-ups remain separate evidence; no device action performed.

### Peer chat containment (093)

Reviewed chat.py end-to-end plus shared admission. Chat now checks bounded portable ids and peer/direction ownership before execution, refuses duplicate foreign sessions and outbound peer path ids, opens only regular no-follow0600 transcripts and escapes embedded newlines. Persistence failure propagates rather than reporting success. Shared conditional request reservation occurs before the model await; tokens are charged afterward without a second request debit.16 chat/admission integration regressions pass and full n2n contracts pass. Existing ordinary UUID sessions remain compatible; malformed historical ids need a new session. No live provider request or operator conversation mutation occurred.

Validation milestone: all24 families pass after090; subsequent ANTA/Redfish verdict and n2n chat follow-ups pass. The Redfish generic runner still lists its default-port capability unavailable; the separate earlier18000 official fixture result is the live evidence. Mac native CI reached SwiftPM deployment mismatch;9559745 adds supported Flutter config-only preparation and awaits rerun.

Next source candidates, not yet closed findings: inventory cache paths/staleness; ACME subprocess timeout cleanup; certificate renewal returning the unchanged CA/hub or unchanged ACME certificate and retiring its same key fingerprint. Reproduce before repair.


### Certificate lifecycle review (094–096)

Read renewal, certificate persistence, ACME process execution and heartbeat status paths. Real registry fixtures reproduce unchanged/same-key false success, two-service pins reproduce broken successor identity, and actual local subprocesses reproduce cancellation/timeout leakage. Fixes retain routine private keys, validate changed/current certificates, report registry health, atomically write certificates and terminate/reap owned processes. The pinned lego v4.19.2 official cmd/cmd_renew.go confirms --reuse-key support. CA/hub issuance remains create-once; automatic successor-key overlap is not implemented and its public claim is corrected. Full federation contracts:528 passed (n2n-renewal.json). No live ACME/DNS or operator credential rotation occurred.


### Inventory and supporting federation modules (097)

Read inventory.py completely and traced service cache callers. Fixed aggregate visibility, literal/effective secret matching, safe cache components/private writes, UTC and missing/future timestamp freshness.15 targeted regressions pass; n2n-inventory.json records full538-test pass. Read gait.py append/commit/failure and recent paths, negotiate.py legacy/possession boundary, push_notify.py FCM credential/signing/token/platform/fallback paths, knowledge.py readonly content-free registry aggregation and routing, and replication.py lifecycle. GAIT git storage is append-only by application convention, not tamper-proof against the host owner; FCM runtime remains outside offline source acceptance. Replication source exposed a possible repeated-start/promotion registry-loss case still being reproduced; its disposition remains pending.


### Replication and lab execution scope (098–099)

Replication transfer/publication source and real Chroma/SQLite failure paths reviewed:10 focused cases,542 federation tests, and full unit family pass (n2n-replication.json,unit-replication.json). Cross-store abrupt-process recovery is explicitly documented, with retained rollback protection rather than a distributed atomicity claim.

Read FRR compose service capabilities/networks/mounts, setup/teardown/verify scripts and corrected README. Actual shell command-recorder fixture fails on old broad bridge/route scope and passes after repair; all three scripts pass bash syntax. Read multivendor lab Dockerfile/start/topology/inventory: lab-only default credentials, floating images and reserved/local sample addresses are explicit fixture boundaries, not production recommendations. Read Twitter registration and Twilio voice JSON examples; credentials are placeholders and controls are examples, not live setup evidence. No GRE lab host changes were made.


### Canvas, chart presentation and native CI (100/087)

Canvas request/session/autosave/import/export paths reviewed, plus React entrypoint and upstream notice. Production handler tests reproduce deleted-session resurrection and swallowed save/delete failures. Request/session admission prevents async replies crossing reused node IDs. HUD224 tests and production build pass; actual WSL Chromium against isolated HUD/gateway passes HTTP200, WebSocket, both chat fixture replies and a refused New-chat action during the delayed Canvas reply, with no JS exceptions. Windows recheck could not launch because WSLInterop binfmt registration is absent (Exec format error); earlier Windows acceptance is historical, and host interop repair remains deferred to the post-main local repair phase.

Read chart normalize/categorize/ordering/presets/force-layout/layout/peer-detail/layout-store modules, saved-layout validation/application boundary, camera/expansion/accessibility modules, and renderer disposal/event cleanup in nodes/links/bands/index/drag. These are presentation/state boundaries, not authority to execute provider operations. HUD tests cover finite coordinates, preserved presets, liveness distinctions and DOM-safe labels; no full animation/performance certification is claimed. Canonical HUD README now points to the real IPv6 lab/shared Python installer and removes stale inventory counts/Python OpenClaw installation advice.

macOS run36325037956 (f4fdd5a) passed Flutter3.44.8 analysis/tests, config-only preparation, iOS Runner simulator and WatchApp simulator builds on macos26/Xcode26.6. macos-native-ci.json records all steps. Firebase plist is explicitly non-production CI data; this is compilation acceptance, not live push or a signed/physical-device release. T127 is closed.


### Optional Zoom panel and UI asset boundary (101)

Read overlay.js, manifest scope/host declarations and panel.html; traced the toggle in panel.js. The optional overlay module is not loaded by shipped HTML, so the UI now reports unavailable instead of enabled. Two production-handler failure fixtures and a mocked SDK partial-start cleanup fixture pass; HUD227 tests pass. Live Zoom Layers entitlement/frame submission remains unverified and is not enabled by this fix. CSS files were checked for external-resource/executable sinks; HUD CSS compiles in the production build. The public fixtures symlink resolves to tracked spec072 static fixtures; licensing notice retains upstream MIT text.


### Mobile links and measured execution (102)

Read device_deep_link.dart, notification_deep_link.dart, push_message_ingest.dart, pending_open_intent.dart, pending_approvals_headless.dart, border_health_headless.dart; read Swift HeadlessEngineRunner, WidgetDataStore and WatchRelayPlugin. Device-link hostile input reached an actual recording RPC before repair and now yields zero calls. Full Flutter432/analyze pass. Native background/foreground disposal paths exposed further lifecycle candidates and remain under review.

Instrumented actual N2N542 and Flutter432 runs. measured-execution-102.json records covered source line numbers, measured totals and source hashes, explicitly including import execution. Only pending paths with at least10 covered lines and50% measured statements receive execution-coverage, not semantic-review status. This is line evidence, never a claim of100% branch or device coverage.

## Bounded closeout

Explicit user amendment ends broad review. All103confirmed repairs verified: final24contract families,434Flutter/analyze,227HUD/build/audit0,6reconciliation/spec gates; macOSCI36326574760 Runner+WatchApp success on production source identical to1709ddc.751unreviewed paths are deferred-review, not passes. See deferred-review.md, handoff.md and mac-handoff.md.
