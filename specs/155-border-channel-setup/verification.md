# Specification verification — Spec155

**Date:** 2026-10-25
**State:** Mac installer reconciliation is complete within the explicitly documented fixture and editor scope; T047 and T050 are complete. WSL qualification (T048) remains partial. Overall Spec155 completion is **false**. Earlier sections are chronological checkpoints, not the current completion state.

## Baseline and authorized scope

- Branch `155-border-channel-setup`, base commit `a5480b4cea4cf3729a25576fa75394b41257faab`; existing feature/user/agent-context edits preserved. No branch switch or live runtime reconciliation.
- Source baselines: OpenClaw `2026.7.1-2` / `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`; Hermes `0.21.6` / `818c13be1dc4fd28987e1e881a9408224afd4535`.
- Local shell reports Python 3.14.6 and Node 25.3.0. Node 25 is outside the HUD acceptance policy; actual runtime acceptance must select a supported isolated Node version.
- New private test homes only. Preserve existing Mac/WSL homes, process state, identities, certificates, policy and budgets. No model sessions, device reads, live capture, calls or coordinated network window.

## Actual credential checks

On 2026-10-25, the owner's root `.env` Discord bot token authenticated via `GET /users/@me`: HTTP 200, bot account, configured application IDs matched. The owner-supplied export's Slack bot passed `auth.test` and Webex bot passed `GET /people/me`, both HTTP 200. No message, gateway session or call was started by these checks. These results establish authentication only, not installer completion or message transport/delivery.

Twilio account and phone-number metadata checks returned HTTP 401; the phone-number response identified error 70051. Identity/permission resolution remains pending. The export has API-key credentials but not the distinct `TWILIO_AUTH_TOKEN` required by native SMS paths. Local Zoom client/RTMS material is present; account-specific authentication and callback qualification remain unverified. Teams registration is being prepared by the owner.

The owner subsequently excluded real Twilio use and key reset. Twilio live checks are now out of installer acceptance scope; isolated installation contracts remain required. Authentication/SMS/MMS/call evidence stays unverified. The owner also authorized this agent to create disposable Azure/Teams prerequisites. Azure CLI was absent; a private test CLI environment is being prepared without changing the global PATH or an existing Azure profile.

Teams follow-up: Azure CLI 2.91.0 authenticated but the selected tenant had no accessible Azure subscriptions. The owner explicitly chose the Teams-managed alternative. The isolated Teams CLI 3.1.0-preview.7 created a dedicated test app/bot; registration readback confirmed single-tenant identity, zero declared API permissions, matching app/name and Teams-managed location. Bot Framework client-credential authentication returned HTTP 200. The test secret expires 2026-11-01; the CLI's initial two-year test secret was retired after the shorter-lived one authenticated. Credentials and cleanup metadata remain private outside the repository. No endpoint, tunnel, Azure resource, message or call was created. The account's existing custom-app upload policy prevents Teams installation; that policy was preserved and delivery remains unverified.

## Implementation checks so far

- Comms manifest/schema checker: 77 runtime-specific entries, including 33 OpenClaw channels, 28 Hermes platforms, 10 related interfaces and three NetClaw surfaces represented for both runtimes.
- Eleven Comms catalog tests: full inventory, canonical/native IDs, pin absence versus incomplete implementation, role/host restrictions, Twilio/Zoom search, strict schema and legacy plan compatibility.
- Sixteen plan tests, fourteen engine tests, seven live-verification tests and nine existing catalog tests passed. Added coverage includes deterministic Comms ordering, manifest review binding, refusal to activate after incomplete Comms setup, additive test direction and binding-owner/collision refusal.
- Catalog generation and metadata checks passed. New adapters remain explicitly incomplete until implemented; these unit checks are not actual installer acceptance.

The export and unpack script remain untracked and locally Git-excluded. Independent validation checked the bundle checksum and all 467 file checksums before private extraction (0700 directories, 0600 files). Exported live state was not adopted. Private reports retain field presence and sanitized outcomes only; no secrets or private destinations enter these artifacts.

## Checks performed

- Source investigation against `a5480b4cea4cf3729a25576fa75394b41257faab`; pure adapter/validator results are in [investigation.json](investigation.json).
- Inventory contains 33 OpenClaw index entries, 28 Hermes messaging platforms, 10 related references and three existing NetClaw Comms surfaces. Twilio is explicit; Zoom is a NetClaw integration rather than an invented native channel.
- All 35 individually reviewed OpenClaw documentation pages and 34 Hermes messaging guides are represented. The 34 Hermes guide names also match the pinned source directory at `818c13be1dc4fd28987e1e881a9408224afd4535`, excluding the index and category metadata. The optional telephony skill is separately linked to that source revision.
- Twelve synthetic draft-validation cases cover two runtimes, three roles and two existing components. Focused/member cases have no validation errors; Border cases report only `border_domain_capability`. These checks establish current plan-role rules, not successful component installation or operation.
- Six user stories, FR-001–FR-032 and SC-001–SC-009 are present and contiguous. Local references resolve, inventory links match the recorded entries, and no unresolved clarification placeholders remain.
- JSON parses and the feature pointer matches branch `155-border-channel-setup`. Whitespace checks cover tracked changes and new specification files. One extra blank line at EOF was found and removed during review.

## Boundaries

Source implementation and private isolated runtime/build environments are now in progress. The explicitly authorized disposable Teams app/bot is the only created provider identity. Existing runtime configurations, channel accounts, shared policy, model/device operations and meeting state were preserved. No messages or calls were sent.

The [requirements checklist](checklists/requirements.md) assesses specification quality. It does not mark the feature implemented or every channel qualified. The [analysis](analysis.md) and 50-task ledger track implementation and qualification gates separately.

## Guided setup implementation checkpoint

- T001–T013 complete. CLI, assistant and VS Code expose all 77 entries; multiselection preserves retained settings and explicit None. Extension typecheck/build and six targeted frontend tests passed.
- Eight new ownership/configuration tests passed for Slack/Discord/Telegram on both runtimes. Six actual configuration validations passed using private OpenClaw 2026.7.1-2 and Hermes 0.21.6 environments with placeholder credentials. These checks made no authentication or transport claim. Source presence/native schema validation alone is insufficient to prove separately packaged OpenClaw channel dependencies are installed; that integration remains open.
- The Python setup suite passed 165 tests with six existing optional/environment skips before the subsequent service/Zoom slices. Two new messaging-role/fresh-state tests and the eight existing Risk tests passed after those edits.
- A supported private Node 24.19.0 and pinned private Hermes environment were installed outside the repository. Pinned OpenClaw native-helper compilation passed. Packaging exposed missing native plugin metadata; the upstream postbuild step was added. An actual packed helper then passed Telegram adapter inspection with network connections denied. Selected interactive configuration, dependency acquisition and engine integration remain open.
- Zoom inert-discovery tests passed, including actual FastMCP/MCP wire discovery under a network-denying audit hook and refusal of an effectful tool call. Discovery skips all ingress/RTMS imports and disables FastMCP update checks. A dedicated two-home binding test passed interrupted-first-write recovery, secret reuse for that attempt, preservation of each provider credential and foreign revision refusal. Both-runtime managed registration/lifetime acceptance is still open.
- The user asked whether WhatsApp was included. Confirmed OpenClaw WhatsApp, Hermes WhatsApp and Hermes WhatsApp Cloud API are distinct inventory entries. Their native pairing/onboarding paths remain implementation work.

## Subsequent installer isolation checks

- Python setup suites passed **174 tests, six skips** with the isolated Node 24.19.0, Zoom and voice dependency environments enabled. The six skips remain explicit environment/optional checks; no provider delivery or platform acceptance is inferred.
- T014 configuration merge, wrong-owner/revision, interrupted-write and exact selected-channel terminal authority tests passed. This completes that test task; T015–T019 onboarding implementation remains open.
- T036 uses the pinned Twilio core package through its private environment wrapper and lockfile. Actual stdio discovery passed with network connections denied, existing Call/Message filters retained and no credential values in process arguments or output. The new directory is explicitly included by Git's source ignore rules; its dependencies remain ignored.
- T038 managed voice tests passed with actual imported voice dependencies and placeholder credentials. The owned identity/loopback gateway is checked; Hermes voice routing refuses. Failed gateway requests cannot fall back to a direct model, basic device commands or a neighboring Memory MCP. Context files are private and scoped to the owned home. Legacy behavior remains outside the managed flag. No HTTP listener, provider call or model session ran.
- Zoom binding revision acceptance was tightened to the last journaled write, preventing a stale earlier environment revision from being adopted.
- The official OpenClaw WhatsApp and Hermes WhatsApp/WhatsApp Cloud API pages were rechecked on 2026-10-25. All three remain catalogued; linked-device pairing and Cloud API onboarding are still marked incomplete rather than qualified.

## Selected runtime and binding checkpoint

- T032 explicit Comms-member Twilio/Zoom selection is implemented in the catalog, wizard and CLI with independent owner settings and preserved Border restrictions.
- T034 same-plan Zoom binding is exposed in both wizard and CLI. Drafting creates no secrets or listeners. Selected binding replaces manual bridge settings with a dedicated secret at apply; it rejects wrong owners, duplicate Border consumers and plan/host port collisions. Four Zoom tests passed with the actual inert MCP environment, including matching recovery through `EffectRunner.observe`, stale settled-revision refusal and preservation of both homes. Extension typecheck/build and seven Comms/wizard tests passed. Process lifetime/active ingress qualification remains T035.
- A new pinned Hermes selected-platform inspector passed three actual-runtime suites covering all **21 bundled channel choices** (including the two WeCom modes), disabled/malformed input refusal and typed configuration readback. It hashes the qualified source, respects manifest/version/disable gates, loads only the selected plugin and forbids network, subprocess or filesystem writes during inspection. It never calls `setup_fn`, `create_adapter`, `ensure_deps_fn`, `is_connected`, broad gateway setup or all-platform discovery. Built-in channels without an audited passive contract remain unverified.
- Slack/Telegram/Discord SDK additions use separate universal hash-locked requirements constrained against the qualified Hermes core. Actual private installation added eight packages while preserving all **87 pre-existing package versions**. The qualified aiohttp 3.14.4 baseline is retained rather than using the older 3.14.3 extra pin. The three inspector suites passed again after installation. This is local dependency/configuration evidence, not provider connection or full installer acceptance.
- Source inspection found Hermes' existing WhatsApp `--pair-only --pair-json` path still registers message-update/upsert handlers. The planned owned pairing bridge must suppress those handlers; no QR pairing or account link was started.


## OpenClaw acquisition and WhatsApp Cloud configuration continuation

- Hermes WhatsApp Cloud API has a typed private form distinct from linked-device WhatsApp, including Meta numeric phone-number ID, access/app/verify secrets, loopback port and prepared HTTPS `/whatsapp/webhook` callback. Restrictive access and no startup notification are preserved. Four actual Hermes inspector tests passed, including Cloud readback with writes/network/processes prohibited. No Meta authentication or callback reachability is asserted; both QR pairing paths remain open.
- OpenClaw's published Slack plugin retains source `extensions` but ships `runtimeExtensions` under `dist/`. The initial helper checked the source entry incorrectly; validation now uses the pinned native compiled-entry resolver. A subsequent isolated fixture initially lacked npm on PATH; no acquisition ran, and adding the observed npm directory corrected that test environment.
- Actual Slack acquisition passed package SRI/version, dependency, selected host peer and compiled-entry checks. Configuration remained unchanged. Actual native SQLite registration, static discovery, configuration validation and selected setup-only adapter loading passed with network connections/listeners denied for registration/validation/inspection. Reconciliation preserved logical install records; native SQLite metadata/cache reads changed database bytes, so byte immutability is not claimed.
- The installer now builds the helper inside a fresh separately owned OpenClaw 2026.7.1-2 home using pinned source 0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c, frozen pnpm dependencies and private pnpm 11.2.2. Actual core installation, helper build/promotion and every-chunk observation passed. Build failures and missing completion receipts cannot silently replay package managers.
- Actual `configure_channel` completed for Slack and Discord in that isolated home using placeholder credentials. The second configuration preserved provider/workspace settings, Slack channel configuration and its existing native install record. Native config validation had network/listeners blocked. A first fixture ordered its synthetic onboarding effect after the Slack effect and correctly hit the revision guard; correcting the fixture's order to match the real engine allowed Discord to finish. Authentication, transport, inbound and outbound remain unverified.
- Shared OpenClaw plugin allow/deny/global enablement policy is preserved. Selecting a channel changes only its plugin entry; conflicting shared policy blocks configuration. Eleven onboarding tests and three helper ownership/replay tests passed. The broader Comms suite passed 38 tests with eight runtime-environment skips; full integrated acceptance is still open.
- Current task ledger remains 18/50 verified complete. These are partial advances in T015/T017/T019, not claims that all native adapters or full Mac/WSL acceptance are finished. No messages, calls, QR links, model sessions, device reads, existing-runtime changes or publication occurred.


## Message request/report integration and Hermes webhook forms

- T027 is complete: VS Code and CLI materialize selected owner/channel/outbound requests, keep imported directions/destination references, and do not send during drafting. Unimplemented inbound paths are not offered as executable tests. Six CLI tests and the frontend request/parity checks passed.
- T031 is complete: per-channel configuration, authentication, transport, inbound and outbound observations survive structural report projection. Public/detailed exports drop raw output, provider receipts, destinations, secrets and private evidence bindings. Counts distinguish submission from final delivery; invalid cross-dimension success codes cannot become verified. Configuration changes invalidate earlier message evidence, a later declined request does not erase an unknown send, and cleanup invalidates current readiness while retaining private pre-cleanup history.
- The full Python setup suite passed 187 tests with six environment skips before the subsequent webhook/report refinements. Extension typecheck/build and 13 affected Comms/wizard/native-terminal tests passed. Seven evidence/privacy/cleanup tests and seven existing consent/send-contract tests passed after refinement. No actual messages were submitted.
- A second fresh private OpenClaw installer-helper run completed core acquisition, pinned helper build, Slack/Discord acquisition/registration/configuration, static native dependency observation and per-channel report generation. Registration, validation and readback used a network/listener denial guard. Both channels reported configuration verified, authentication/transport unverified. The source-input and full compiled-graph hash bindings matched. Provider/workspace settings and Slack's registration survived Discord setup.
- Hermes Teams and native Twilio SMS now have typed forms. Teams requires single-tenant IDs/secret, loopback port, prepared HTTPS `/api/messages` URL and explicit Entra sender IDs. SMS requires the account auth token (not an API-key secret), E.164 sender/allowlist, exact HTTPS `/webhooks/twilio` URL, loopback listener and signature validation. No tunnel, public route, bot endpoint change, number purchase or send is performed by these configuration effects.
- The actual private Teams SDK installation added seven packages and preserved all 95 existing package versions. Source-pinned dependency checks import the real Teams SDK symbols with dotenv loading suppressed and effects prohibited; they never invoke the lazy installer or instantiate its application. Five actual selected-Hermes suites passed, including all 21 bundled choices, Teams/SMS typed readback and unsafe-access refusal. Twelve owned-onboarding, 16 plan, three callback/service and 14 engine tests passed. Teams authentication recorded earlier is separate from these placeholder-credential configuration tests; no live Twilio call was made.
- Task ledger: 20/50 verified complete. Remaining native adapters, linked-device pairing, live service observations, full recovery/consent contracts, Zoom lifetime/registration, final editor/Mac/WSL qualification and coverage reconciliation remain open.

## Progress report checkpoint

- The latest full Python setup run completed successfully: 194 tests, six explicit skips (188 passed). Extension typecheck/build and all 13 affected Comms/wizard/native-terminal tests passed.
- A separate actual Twilio SDK fixture test passed signature validation, exact account/message/destination scope, duplicate and out-of-order callbacks, conflicting terminal outcomes, and redacted evidence. Network connections and listeners were denied, and only fake credentials/identities were used. Submission acceptance and delivery remain distinct. This reducer is not yet integrated with the installer callback path, so T030 remains open.
- The verified task count remains 20/50. This is a task count, not a measured percentage of implementation effort or release readiness. No merge, publication or 100% completion is claimed.


## Parallel implementation and isolated editor checkpoint

- The owner requested parallel completion and resumed the task. Three agents worked on disjoint Hermes, OpenClaw and service/evidence files; shared catalog, engine, frontend and component integration stayed with the parent. The branch and uncommitted changes were preserved.
- The catalog still contains all 77 runtime-specific entries. Expanded Hermes forms now cover 22 additional paths, with pinned selected-plugin/source checks, private credentials and restrictive access. Actual SDK qualification added 45 packages to a separate environment while preserving its 102 pre-existing versions. Linked-device pairing does not imply provider readiness; synthetic pair receipts remain fixture evidence.
- Actual OpenClaw acquisition, native registration and configuration validation passed for 16 expanded typed channel plugins. Shared policy, provider configuration and other channel registrations were preserved. Additional prepared-native and personal-account paths are still being integrated; the catalog must not be read as a live-provider qualification claim.
- Fresh component acquisition passed for **both runtimes × Twilio and Zoom** across two empty private homes. The installer used committed npm/Python locks, installation-owned interpreters and durable intent/completion receipts. Repeated observation used the completion receipt without replaying package installation; an interrupted intent refused automatic replay. Two acquisition tests passed in 32.981 seconds. Private evidence: `~/.local/share/netclaw/spec155-native-tests/comms-acquisition.log` and `comms-acquisition/`.
- Actual native registry probes passed for **OpenClaw/Hermes × Zoom/Twilio core** through the fixed managed launchers. Server socket connections/listeners were denied, credentials were placeholders, and native configuration/environment bytes were unchanged. The rerun after cancellation cleanup passed in 21.873 seconds (`native-comms-resume.log`). Interpreter shims in this registry fixture test registration/discovery; runtime acquisition is established separately above.
- Zoom's six tests passed with the real isolated SDK/MCP environment. They include inert discovery/tool refusal, owned binding recovery, two same-process MCP lifetimes, and actual loopback webhook/panel startup on ephemeral ports followed by shutdown with ports/threads released. No meeting/capture, provider connection or Border client ran. Importing the module starts no services; active MCP lifespan owns the single meeting registry and its background services. This closes T035, not live ingress qualification.
- Bounded OpenClaw discovery passed five actual-process cleanup cases including timeout, output flooding and abrupt supervisor death. A private one-use lease binds exact OS process birth identities and descendant relationships; a watcher revokes only the owned child. Foreign process/generation/path attempts refuse and a neighboring process is preserved. Combined with the native registry rerun, T033 is complete.
- Actual isolated **VS Code 1.109.0** passed keyboard selection, Slack/Discord multiselection retention, narrow light / medium dark / wide high-contrast layouts, and 200% zoom without horizontal overflow. The preview performed zero installations/provider calls. Evidence is the private preview `netclaw153-preview-sfqm99bx/report.json` and screenshots; the historical helper name does not change the Spec155 content tested. The installed 1.108 editor was incompatible, so a private 1.109 test download was used; the user's ordinary editor was not changed. T044 is complete.
- After the expanded metadata and frontend guards were integrated, extension typecheck/build and all 13 targeted Comms/wizard/native-terminal tests passed. Unsupported Hermes voice remains visible but cannot select or misleadingly appear enabled through the shared Twilio component.
- The first integrated Python continuation ran 252 tests with 28 explicit environment skips and one test-fixture canonical-path error. The OpenClaw agent corrected that fixture; this run is not recorded as a pass. A final integrated rerun remains required after its remaining files settle.
- Documentation now includes all official inventory links, Discord/Teams preparation, native SMS versus telephony versus NetClaw MCP distinctions, same-plan Zoom ownership, prepared native prerequisites and the OpenClaw Teams wildcard-listener disclosure. Assistant guidance uses native secret entry and preserves configuration/authentication/transport/delivery distinctions. No existing runtime, provider route, shared policy, account token, model session, device state or release was changed.


## Integrated qualified regression results

- The final qualified Python setup run passed **264 tests: 253 passed, 11 explicit skips**, in 141.545 seconds. It used the separate 147-package Hermes environment, supported private Node, real Zoom/Twilio SDKs, the pinned OpenClaw package and source schemas. Acquisition and external-package cases with separate explicit opt-in are accounted for independently; skips are not passes. Private log: `integrated-setup-qualified-final.log`.
- Extension typecheck/build passed. The complete extension suite passed **143 of 146 tests, three explicit skips**, in 29.770 seconds using a standalone Node 24.19.0. An initial full run correctly rejected global Node 25; the next rejected the npm fixture's hard-linked Node binary. A byte-identical private copy with one inode link and mode 0700 resolved the test environment. No executable safety guard was weakened. Private log: `extension-node24-owned-final.log`.
- The final actual native registry rerun passed all four OpenClaw/Hermes × Zoom/Twilio-core combinations in 27.529 seconds after the process-lease cleanup hardening (`native-comms-final.log`). No provider/listener/capture was permitted in discovery.
- Component review found and fixed missing component phase/selection/role guards and unjournaled runtime-pointer observation. Receipt and runtime records now require the exact owner, component, artifact class, private revision and expected interpreter location before execution. The renewed acquisition suite passed all three tests in 33.152 seconds, including four actual component installs across two new owned homes (`comms-acquisition-final.log`).
- Actual pinned OpenClaw WebChat configuration validation passed with socket/listener/fetch operations denied. WebChat reuses the owned token-authenticated loopback Gateway and writes no retired channel section. Browser connection and agent dispatch remain untested.
- Actual shared Hermes configuration effects passed Photon, HomeAssistant and Raft acquisition/readback while preserving provider, MCP, other channel and environment settings. Buzz passed with an explicitly compiled native handoff fixture, not the upstream Buzz executable. WhatsApp acquired its actual dependencies and correctly remained configuration-required without a pairing session, leaving native environment/config unchanged. The five-channel scenario passed in 31.356 seconds (`hermes-owned-effects.log`). The seven selected-native SDK/readback tests passed in 66.484 seconds. See `hermes-adapter-evidence.json` for all 28 outcomes.
- Configuration-valid saved drafts with empty access now refuse messaging-service activation. Account-bound personal channels, reviewed Raft profiles, exact Home Assistant entities and authenticated loopback WebChat have distinct access contracts. Registration tests reject forged prior metadata and foreign same-name replacements while retaining unrelated MCP entries on both runtimes.
- Remaining work is the frozen-source whole-engine Mac acceptance, explicit WSL execution, final coverage reconciliation and source review. Provider authentication/transport/delivery remain distinct; no operational capability acceptance is inferred from these installer checks.


## Source push and WSL handoff checkpoint

The owner explicitly authorized committing/pushing Spec155 source and requested a copyable WSL prompt. This supersedes the source-push hold for this feature; merge, release/Marketplace publication and deployment into existing runtimes were not requested.

Actual complete engine dispatch from empty private homes ran for both OpenClaw and Hermes against a frozen 4,462-file source snapshot (tree hash `f719d949d0cd76dbd1d54695c5da7251b2ce9a5f02f5c2dfa3c369c00d0528a3`, base Git HEAD `a5480b4cea4cf3729a25576fa75394b41257faab`). Each verified eleven effects through source/runtime acquisition, credentials, onboarding, minimal component, skills, MCP registration, inputs and both Slack/Discord configurations. Both stopped before any service artifacts or service-manager action because placeholder accounts had no allowed senders. These are successful configuration/negative activation cases, not fully operational installations. The frozen engine initially labelled the known refusal unknown. The source now returns configuration-required for that exact pre-activation prerequisite; unexpected/uncertain failures remain unknown. A read-only call against both actual acquired fixtures verified the corrected result with zero service artifacts. Existing unknown journals were not rewritten or resumed automatically.

The final review caught missing startup disclosures on nineteen Hermes entries. All twenty-two expanded Hermes metadata rows now state their actual connection/polling/bridge/listener/account-linking behavior. Home Assistant includes provider state subscription and device read/control tool registration. Exact review also includes capability kind and setup explanation. The catalog-to-review regression passed for every selectable channel. The frozen whole-engine source predates these metadata and status corrections; affected catalog/plan/engine/service checks apply to the final source separately.

OpenClaw's final dedicated native suite passed 18/18. The final Zalo SDK-root/SRI binding delta passed another 5/5 after correcting its owned `dist/cjs` package-root lookup. Final recovery7 and service8 tests passed after the missing-control-receipt and known-access-status fixes. No provider account was linked by these fixtures.

The ledger has 47/50 scoped tasks checked. T047 retains the remaining positive full installer/platform qualification beyond these blocked-service Mac cases; T048 awaits actual WSL execution; T050 awaits final reconciliation after that return. The current all-entry coverage ledger is complete as an accounting artifact and explicitly has `complete: false`. No 100% or release-readiness claim is made. Related-interface references remain distinct from selectable conversation channels.

The handoff is in `wsl-handoff.md`. All 178 changed public source files were compared locally against secret values from the owner's root environment without exposing values; no matches were found. `.env`, `env_exported` and its unpack script remain ignored. No private runtimes, test logs, secrets or dependency caches are included in the source handoff.

## WSL qualification return — 2026-10-25

This pass fetched and tested exactly `c3aa0951519a0be79db085f7092043ee1c97d830`
in a separate worktree on `155-comms-wsl-qualification-20261025`. The original
`153-ide-installer` checkout, its modified testbed and untracked backup were
preserved. All test homes, caches, credentials, setup journals and editor profiles
were private and separate. The earlier Mac credential checks above were **not**
repeated or inherited as WSL authentication evidence; only fixture credentials
were used in this pass.

The actual host was Ubuntu **26.04 LTS**, WSL2 x86_64, kernel
`6.18.54.1-microsoft-standard-WSL2` (the distribution registration still says
`Ubuntu-22.04`). System Python was 3.14.4. A private Node 24.19.0 archive was
verified against the official SHA-256 manifest; its owned executable had one
inode link. Default Node 25 was not used for qualification. Host uv 0.6.14 selected
Python 3.14.0a6 and the Hermes installer correctly refused it. A separate empty
home with private uv 0.9.5 acquired stable Python 3.14.0. System tools were unchanged.

### Test results and corrective work

| Check | Actual WSL result |
| --- | --- |
| Comms catalog, catalog metadata and coverage scripts | All passed; 77 entries retained |
| Extension dependency install, typecheck and build | Passed with private Node and committed lockfiles |
| Final full Python setup suite | 268 tests: **261 passed, seven skipped**, zero failures/errors; 204.383 seconds |
| Fresh Twilio/Zoom acquisition | Three tests passed, including four real installs across OpenClaw/Hermes; 68.583 seconds |
| Native Comms registry discovery | One test passed across all four runtime/component combinations; 25.093 seconds |
| Final full extension suite | 146 tests: **137 passed, six failed, three skipped** |

Exact individual results, skip/failure names, initial unsuccessful runs and private
log hashes are in [wsl-results.json](evidence/wsl-results.json). No raw test log or
environment file is published. The seven final Python skips are the separately
passed acquisition test (not repeated in the last run), three separately acquired
OpenClaw external/personal-package fixtures, two disposable-systemd fixtures, and
the pinned Specify CLI fixture. Extension skips concern installed native
OpenClaw workspace resolution, macOS launchd and cached-embedding RAG retrieval.

All six extension failures report that the user service manager is unavailable
in the isolated test environment. They cover both runtime lifecycle tests,
changed-scope refusal, orphan recovery, combined save/restart and four-pair
harness switching. They remain failures. The tests were not granted access to
the existing shared manager to manufacture a pass.

Three test-only corrections are included in this branch:

- Actual component acquisition now replaces the generic macOS/ARM sample-plan
  host with `host_identity()`, selecting the real WSL Zoom lock. The first
  acquisition run installed Twilio but failed both Zoom subtests on the wrong
  host lock; the corrected actual acquisition passed.
- The expanded Hermes SDK assertion includes Matrix after real WSL SDK
  acquisition and import/readback passed.
- The concurrent adapter test accepts either refusal of a reserved request or
  successful readback of the already durable request, while still requiring
  exactly one `/api/chat` submission. The original assertion rejected the valid
  latter schedule. The complete extension rerun passed that case.

Initial Python runs lacked jsonschema, then cryptography. Another run bound the
certificate test to Zoom's interpreter, which has a different locked cryptography
version. The private test interpreter with cryptography 46.0.5 passed all four
certificate tests and the final full suite. Initial extension imports also
required `npm ci` using the committed HUD lockfile. No dependency pin, runtime
guard or production implementation was changed to address these fixture errors.

### Actual installer evidence and fixture boundaries

Both real engines acquired their pinned runtime into empty Focused homes:
OpenClaw `2026.7.1-2` at `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`, and Hermes
`0.21.6` at `818c13be1dc4fd28987e1e881a9408224afd4535`. Each verified eleven
effects through source/runtime/dependency acquisition, private credentials,
onboarding, minimal component, skills, MCP registration, inputs, identity and
Slack/Discord configuration. Homes were 0700 and environment files 0600. Empty
sender access produced `configuration_required` before service artifacts or
manager activation. Final read-only verification ran and remained `unverified`.
The private wrapper wrongly expected that verification to remain pending, so
both wrapper exits were 1. Separate read-only assertions checked the actual
postconditions; neither journal was rewritten or replayed to hide that error.
See the [OpenClaw engine](evidence/wsl-openclaw-engine.json),
[Hermes engine](evidence/wsl-hermes-engine.json) and their separate redacted
[OpenClaw report](evidence/wsl-openclaw-report.json) /
[Hermes report](evidence/wsl-hermes-report.json).

Fresh Twilio/Zoom acquisition used real locks, installation-owned interpreters,
intent/completion receipts and ownership checks. Native registry discovery used
real native CLIs with owned interpreter shims and socket/listener denial;
configuration/environment bytes were preserved. Acquisition evidence is separate
from these registry fixtures. Five actual Linux process cleanup tests passed,
including timeout, output flood and supervisor death, with the neighboring
fixture process preserved. Missing receipts, changed ownership, retained
channels and interrupted-write recovery passed their contract tests.

Hermes SDK acquisition grew the isolated environment from 93 to 155 packages
without changing any pre-existing package version. The selected native readback
ledger records twenty expanded channels; Teams, SMS and WhatsApp Cloud also
passed their actual selected-runtime tests. Matrix's SDK import/readback passed
on WSL. These are SDK/module dependencies and synthetic configuration inputs;
they do not qualify external daemons, account authentication or callbacks.
See [SDK acquisition](evidence/wsl-hermes-sdk-acquisition.json) and
[readback ledger](evidence/wsl-hermes-readback.json).

The actual Hermes owned-effect scenario acquired/configured Photon, Home
Assistant and Raft. Buzz used an explicitly compiled fixture binary. WhatsApp
acquired its bridge dependencies and remained unpaired/configuration-required,
preserving native configuration/environment. Pair receipts in other tests were
synthetic. OpenClaw expanded forms passed native pinned-source schema checks;
those checks do not prove every selected plugin was installed on WSL. Real
Twilio SDK signatures, callback reducers, voice routing and Zoom MCP/loopback
lifetime tests used fake accounts and controlled local fixtures. None establishes
provider transport or delivery. No model session, device operation, message,
call, meeting capture, account link or coordinated network window was started.

### Editor, preservation and remaining gates

An actual private Linux VS Code 1.109.0 instance activated the extension, but
the local Linux window did not satisfy the genuine WSL remote-host requirement;
the preview timed out without opening the Comms wizard. A separate Windows
1.109.0 archive, private profiles/extensions and private server paths were then
tried. The remote development launches did not establish a WSL extension host
(direct launch exited 255 without a useful diagnosis). No acceptance report or
private remote-server installation resulted. The host guard was not bypassed.
Visual multiselection, both-runtime search/restrictions, keyboard operation and
redacted report inspection in WSL remain **unqualified**; frontend tests and
earlier Mac screenshots do not substitute for them.

[Preservation results](evidence/wsl-preservation.json) compare **8,138 selected
files, 99 logical SQLite tables and ten service PID/start identities** with zero
changes. The original branch/status and both testbed files matched. A further
52 shared-policy/configuration files had no post-start modification time; those
paths were absent from the initial hash snapshot, so this is weaker evidence.
The names `wsl-cml` and `wsl-viz` were not located in the observed roots/tables;
no per-identity hash claim is made for them. Stopped WSL distributions remained
stopped. No enrollment, key reset, mesh operation or existing-home deployment
was issued.

The [coverage ledger](coverage.json) now accounts for all 77 WSL outcomes and
keeps configuration, dependencies, authentication, transport and delivery
distinct. `complete` remains false. Required remote-editor/isolated-manager and
positive installer acceptance remain open, as do the recorded package/optional
fixtures and final Mac reconciliation. T047, T048 and T050 remain unchecked.
This branch is a partial qualification return, not a release or 100% claim.


## Mac reconciliation of the WSL return — 2026-10-25

Fetched and verified `origin/155-comms-wsl-qualification-20261025` at exactly
`04645395530a060b35404ec3a27bc516ae9ba076`. Work is confined to separate branch
`155-comms-mac-reconciliation-20261025` and a separate worktree. The original
`155-border-channel-setup` checkout remains at
`c3aa0951519a0be79db085f7092043ee1c97d830`; its tracked/untracked status is checked
independently of this worktree. New runtime homes, setup journals and editor
profiles are private and separate from existing installations.

The three WSL test corrections were reviewed. Actual acquisition correctly uses
the observed host, and the concurrent adapter test still requires exactly one
synthetic chat submission while accepting valid durable-status schedules. The
Matrix SDK assertion initially failed on Mac because that catalog entry is
WSL-only. The test now requires the actual Matrix SDK only on its supported host;
Mac still executes passive native configuration readback and the four other extra
SDK assertions. Seven actual Hermes tests passed after this correction. A
synthetic host assertion confirms the WSL SDK requirement remains strict; this is
not a new WSL execution result. No production implementation or dependency pin
was changed in this reconciliation.

### Executed Mac checks

- All three catalog checks passed: 77 Comms entries, 110 components, 237 skills,
  zero unexplained catalog gaps.
- Committed extension and HUD lockfiles installed in this worktree. Extension
  typecheck/build passed. Full extension suite: **146 total, 143 passed, zero
  failed, three skipped** (optional native OpenClaw custom-workspace fixture,
  Linux-only service-timezone case, optional actual RAG fixture).
- Full Python setup suite: **268 total, 261 passed, zero failed, seven skipped**.
  Fresh component acquisition, owned Hermes acquisition, MCP 2.3 canary and the
  exact cryptography 46.0.5 helper subsequently passed their separate opt-in runs.
  The two disposable WSL systemd methods and optional Specify CLI fixture remain
  unexecuted on this Mac pass. Separate runs do not rewrite the full-suite count.
- Fresh actual Twilio/Zoom acquisition: three tests passed, covering four component
  installs across two empty runtime homes. Actual native registry discovery
  passed all four OpenClaw/Hermes × Twilio core/Zoom combinations with socket
  denial and inert tool discovery. Voice dependency acquisition/routing contracts
  passed; voice MCP native registry discovery is not claimed.
- Both actual engines acquired their pinned runtime/dependencies and verified
  eleven effects, including independent Slack and Discord configuration. They
  paused after the first Comms checkpoint, rejected a changed target identity,
  resumed explicitly without replaying settled runtime effects, and retained the
  first channel's settings. Both stopped service activation with
  `configuration_required` for empty sender access, with zero service artifacts;
  final verification remained `unverified`. Runtime homes were 0700, environment
  files 0600, and six selected neighboring fixture files per engine were unchanged.
- Positive owned-service fixtures exercised shared configure/install/observe
  functions for both runtimes, actual private plists/manifests/source indexes and
  actual inert child lifetimes. Changed definitions and dead owned PIDs were
  refused, and the neighboring child remained alive. Manager/inspector responses
  and gateway/HUD child programs were synthetic; no provider transport is inferred.

The private engine wrapper had a post-install report-import error after its
installer assertions. Independent read-only postchecks established the existing
journals' actual outcomes without replay, receipt fabrication or journal rewrite.
That wrapper failure is retained separately from installer results in
[evidence/mac-runtime-results.json](evidence/mac-runtime-results.json).

Actual VS Code 1.109 acceptance passed all four OpenClaw/Hermes × Focused/Risk
scenarios (five successful runs, one preliminary Focused run repeated with its
real report). Checks covered WhatsApp/Twilio/Zoom search, keyboard multiselection,
retained native non-secret settings after removal/cancel, Border/member ownership,
panel reopening, actual window/extension-host reload, three themes/widths and
200% zoom. Twelve neighboring editor-fixture files were unchanged; no runtime
home was created by the editor previews. Both actual redacted engine reports were
opened and inspected without editing. **The product report button/export dialog
was not exercised**: its backend deliberately reads the OS account's shared setup
state, whereas these qualification journals remain in separate private roots.
No journal was moved into shared state and no backend was mocked to manufacture
that result. Actual engine installation used controlled review authority, separately
from the actual editor drafting/inspection checks.

Preservation compared **8,012 primary files plus 469 supplemental application/export
files**, **11 logical tables across six observed databases**, **20 existing
editor/runtime process identities**, and **one separately selected live service**;
all compared baselines were unchanged. One new audit-interpreter process appeared;
existing identities were unchanged. Supplementary roots/service baselines were
captured after private tests began and were not test targets. The original branch,
HEAD and clean worktree status were unchanged. These are selected local baselines,
not a claim about unobserved WSL identities or mutable session logs/caches.

Detailed outcomes and limits are in [Mac editor evidence](evidence/mac-editor-results.json),
[Mac preservation evidence](evidence/mac-preservation.json), and
[Mac reconciliation results](evidence/mac-reconciliation-results.json). T047 is
closed for this installer-only Mac scope. T050 records completed cross-artifact
review, the corrected voice evidence, updated milestone draft and GAIT session
closure. T048 remains open; the ledger is **49 of 50 tasks complete**, not 100%.

### Remaining platform boundary

WSL results remain **261 Python passes/seven skips**, and **137 extension passes,
six failures/three skips**. Mac passes do not erase those six isolated
service-manager failures. Genuine Windows-to-WSL remote-editor acceptance,
isolated positive service acceptance and the documented remaining WSL fixtures
remain open in [wsl-handoff.md](wsl-handoff.md) and
[evidence/wsl-results.json](evidence/wsl-results.json). No generic Linux desktop
window substitutes for the remote extension host.

All evidence in this pass is installer-only. Configuration, authentication,
transport, inbound and outbound remain distinct; provider readiness is unverified.
No environment export, account pairing, message/call, model session, device read,
meeting capture, enrollment/key reset, shared-policy change or coordinated network
window ran. No merge, release, publication or existing-installation deployment is
part of this reconciliation.

GAIT session `spec155-mac-reconcile-20261025` recorded the final qualification and
cross-artifact review at audit commit `38297391`; the session trail was displayed.
Source commit/push is limited to the separate reconciliation branch.


## Subsequent production authorization

After the reconciliation push, the owner explicitly authorized commit/PR/merge,
completed-branch cleanup, return to main and production publication. This supersedes
the earlier release hold without changing the observed qualification outcomes.
See [release verification](release-verification.md). Source 1.13.0 / extension 1.3.0
retain T048, 49/50 tasks and all WSL/provider/editor scope limits. Release preparation
also adds the ordinary Python installer/Comms family to CI; native opt-in checks
remain separate. Existing runtime installations are not upgraded by publication.
