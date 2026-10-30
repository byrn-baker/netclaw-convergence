# Spec 153 research: installer, secrets, catalog, Shape Advisor and cleanup

Research date: 2026-10-17. Scope: R7, R8, R9, R10, R16, plus the local prerequisites/source evidence relevant to R4/R5. These are design recommendations from source inspection, not implementation or qualification claims. No installed runtime home, provider, device, credential file or installer was accessed or executed. The two catalog/inventory verification scripts ran read-only with `PYTHONDONTWRITEBYTECODE=1`. The root session owns GAIT.

## Baseline facts requiring corrections to the supplied plan

| Item | Observed evidence | Consequence |
| --- | --- | --- |
| Components | `scripts/lib/catalog.sh` contains **110** actual CATALOG rows with unique IDs. | Keep 110 as this revision's component baseline, but derive the count in code. |
| Installer functions | `scripts/lib/install-steps.sh` has **109** `component_install_*` functions; **`k8s` has no installer function**. | Canonical metadata cannot mark every entry installable until this is fixed or an explicit no-install adapter is implemented. No silent skip. |
| Coverage checker | `python3 scripts/verify-catalog-coverage.py` reports **111 entries** and PASS. Its `load_catalog_ids()` regex also matches the comment's `"id\|Category\|Name\|Description"` example. | Replace this parser with the canonical catalog; its current PASS is not proof of installer function coverage. Add a test for the phantom `id`. |
| Skills | **237** `workspace/skills/*/SKILL.md` files, all with front matter. `workspace/skills` has 238 directory entries because `SKILL-SCHEMA.md` is a file, not a skill. `verify-inventory-counts.py` reports 237 and PASS. | Correct supplied **238 skills** to **237 at research revision**, then use dynamic counts. Do not add a fictional skill to reach the supplied count. |
| Integration count | Inventory verifier reports **176 integrations** = 124 static registrations + 52 documented external integrations. | Components, registrations, integrations and skills are distinct counts. Cards must label each correctly. |
| Access contracts | `config/installer-access.json` explicitly describes only **14 components**. | It is useful evidence, not a complete field/verification catalog. |
| Preflight | `config/installer-preflight.json` has **21 component overrides** plus defaults. | Materialize defaults with provenance; absence of an override does not prove a component works on both platforms. |
| Existing HUD fields | `ui/netclaw-visual/env-map.js` has **87 card IDs**. **39** canonical installer IDs have no identical HUD key; **16** HUD IDs are not installer IDs. | Explicit many-to-many joins are necessary. String suffix/prefix guesses are insufficient. |
| Catalyst Center | Current `.env.example` has one `CATALYST_CENTER_*` group, not duplicate assignments. `mcp-configuration.js` maps card `catc` to nonexistent installer ID `catalyst-center`; the real ID is `catc`. `common.sh` defaults `CATC_MCP_DIR` to legacy `catalyst-center-mcp`; the component function changes it to `catc-mcp`; `core_deploy` still writes a legacy `catalyst-center-mcp.py` path. | Replace the supplied “duplicate Catalyst Center fields” task with precise current join/path reconciliation and stale-field retirement. Do not remove a nonexistent duplicate. |
| Historical estimates | `docs/N2N-RISK.md` context section uses a historical 194-skill/52-registration catalog and explicitly labels tokens as an estimate/model. | Do not present its tool count or 15–30× reduction as current measured performance. |

Other `.env.example` duplicate assignment names found are Twitter API/heartbeat names and `NETCLAW_RUNTIME` / `HERMES_HOME`; these require classification as intentional alternatives or duplicate source declarations rather than automatic deletion.

## R7 — Engine and scoped phase bridge

**Decision:** retain the one-engine design, with a small explicit bridge that sources existing library files but never sources or executes the top-level installer wholesale. The bridge dispatches a fixed phase/component allowlist from validated data, never a function name or shell fragment supplied by a plan. `install.sh` gets only early flag dispatch for the plan pathway; its historical TUI/flag control flow remains a regression baseline.

### Reuse and limits

| Existing code | Useful reuse | Required adaptation for the plan path |
| --- | --- | --- |
| `common.sh:define_runtime`, `define_paths` | Runtime-specific config/workspace/env derivation | Invoke with explicit validated runtime/home/config and clear inherited target selectors; reject missing scope. `common.sh` calls `define_runtime` during sourcing, so scope must be established **before** sourcing. |
| `install-steps.sh:core_prereqs` / `prereqs_offer_install` | Runtime policy and component Python rules | Do not call as an unreviewed probe: it can offer and run package remedies, and exits the shell on failure. Bootstrap uses read-only checks; remedies are separately reviewed visible-terminal phases. |
| `core_runtime` / `runtime-install.sh:netclaw_install_openclaw` | Runtime presence/version and existing npm policy | Existing executable presence is not selected-home readiness. Global prefix installs are shared host effects. Record/review exact executable and version; never update a shared executable without explicit scope. |
| `core_onboard` | Native onboarding handoff | Current OpenClaw path imports checkout `.env` and calls `onboard --install-daemon`; Hermes setup calls `gateway install`. Neither is a safe secret-free automatic phase as written. Disable implicit checkout-env import for new plan installs, explicitly scope native processes, and separate service creation from provider/channel onboarding where supported. |
| `core_gateway_check` | Historical diagnostic guidance only | It accepts any `openclaw-gateway.service`, any launchctl match containing openclaw, or any listener on 18789. This can accidentally certify a different claw. Replace its readiness decision with installation-ID/home/service/endpoint-bound evidence. |
| `run_component` in `install.sh` | Component failure markers, isolated PATH, named component logs | Extract or reuse logic through the library bridge, with structured outcome rather than scanning only `[ERROR]`. Do not persist unsanitized subprocess logs. |
| `component_install_*` | Actual install implementations | Each needs an effect declaration and verified plan-path support. Some mutate shared source, shared binaries, global services or prompt on `/dev/tty`; an allowlisted function name does not make those effects scoped. |
| `core_tokens` | Token library dependency install | Force an owned isolated runtime and journal its installation; do not inherit arbitrary `NETCLAW_PY` / venv targets. |
| `manifest_write` | Established component manifest format | Existing implementation writes in place; plan engine should write atomically under the run lock while preserving byte-compatible content. |
| `core_deploy` | Existing managed MCP merge and private env writer | Split config, selected skills, persona, inventory, and runtime-path recording into explicit effects. It currently deploys **all** skills, links checkout-shared inventory and creates checkout `.env`. That is not the requested selected-skill isolated installation semantics. |
| `install-mcp-config.py:merge_config` | Managed-registration preservation and expected-revision checks | Use explicit config/runtime paths and expected revisions; its template/source mutation assumptions still require source ownership. |
| `installer-readiness.py` | Separates artifact, access, discovery and provider readiness | Preserve distinctions. Hermes direct MCP discovery is explicitly **not** Hermes agent-visible discovery; remote Hermes probe and live provider turn remain unverified until exercised by dedicated adapters. |
| `extensions/netclaw-vscode/src/client/setup.ts` | Explicit host/home/installation identity, env scrubbing, prepared baselines, unknown timeout state | Existing setup requires an initialized installation, so bootstrap needs a provisional ID and its own registry. Reuse concepts, not the existing-home precondition. |

### Interactive and host-global effects inventory

The existing `INTERACTIVE_COMPONENTS` string only lists `checkpoint forward ipfabric threejs-viz jev`. Direct inspection finds additional interactive behavior in `comfyui-viz`, `worldlabs-marble`, Risk role selection/enrollment (`component_install_n2n` helpers), `rag-mcp` (reads `/dev/tty`), core prerequisites, runtime onboarding and `core_defenseclaw`. The plan engine must classify these, rather than trusting the five-entry list. Check Point API-key prompts currently use normal `read -p`; hide their values or bypass those prompts using the engine's reviewed secret flow.

Examples of effects requiring their own reviewed phase or a scoped replacement:

- `packet-buddy`: apt installation of tshark.
- `nmap`: apt installation and `setcap` on the selected binary.
- `gtrace`: copying/moving a binary into `/usr/local/bin` and `setcap`.
- `computer-use`: OS package installation and edits/restarts to system-wide x11vnc/novnc services.
- `core_defenseclaw`: upstream installation scripts, shared DefenseClaw/OpenShell resources, hard-coded `$HOME/.openclaw/config/openclaw.json` writes, even in the decline/hobby branch.
- `scripts/netclaw link` from top-level install: shared command linkage.
- `clone_or_pull`: updates pre-existing component repositories unless a reviewed revision manifest applies.

**Multiclaw preservation decision:** an empty runtime home is necessary but insufficient. `define_paths()` anchors MCP sources in `$NETCLAW_DIR/mcp-servers`; multiple component installers create source-local venvs/build output. `core_deploy` points registrations back into that checkout and symlinks its testbed. A source checkout used by another claw must be treated as read-only. Reuse is permitted only for phases proven not to change that source or shared runtime; otherwise require a separate checkout or a run-owned dependency/build area. Do not claim that an advisory lock alone protects an existing claw from a later source update.

### Journal, lock and resume decision

Use a dedicated private setup-state root outside the source checkout and outside any runtime home, such as `<user-state>/netclaw/setup`. It must be explicitly bound by the trusted bootstrap/CLI and support isolated fixture overrides. Before source/runtime creation it contains a provisional run UUID, canonical target intent, redacted plan/source identities, pending effects and review binding. Once runtime identity exists, keep this authoritative journal and write only a reference under the installation. Never store journals in a git-tracked deployment workspace.

Acquire non-blocking OS file locks in a deterministic order for the canonical runtime homes and each shared source/host-resource namespace an effect would mutate. Python `fcntl.flock` is available on the two POSIX execution targets and supports non-blocking exclusive locks; native Windows only runs the read-only gate. [Python fcntl documentation](https://docs.python.org/3/library/fcntl.html). Hold lock descriptors for the engine lifetime. Include diagnostic PID/run UUID, but a stale PID file alone is never authoritative. Reject symlink/foreign-owned state roots and lock files. Check canonical ancestor identities so a nonexistent leaf cannot alias another install through a symlink.

For each effect: record validated inputs/revisions and an intent event → flush durable journal → execute one effect → inspect actual artifacts/service identity → record outcome and artifact ownership/hashes → flush. Record `running` without terminal evidence as `unknown` after interruption. An effect probe must return `completed`, `not_applied`, `partial`, `conflict` or `unknown`. Only a verified `not_applied`, or a documented idempotent repair of owned partial state, may retry. Package downloads/builds, source clone, atomic config writes, service creation and provider calls need different probes; “rerun the function” is not a resume algorithm.

Editor EOF/disconnect requests pause; complete the current bounded safe phase and start no later effect. Explicit Resume checks plan/source/catalog/target identity, re-acquires locks and re-observes pending effects. Secrets held only in memory must be requested again. A crashed child is not declared stopped merely because the editor disappeared; capture process-group ownership, stop only owned children when appropriate, and record unresolved process state as unknown. Do not use an unattended background installer to satisfy pause semantics.

JSON Lines stdout is reserved for bounded typed engine events. Child output stays on a separate captured stream and passes through redaction before any disk/UI sink. Each event includes protocol version, run ID, sequence, phase/effect ID, status and safe reason code; secret requests include only an allowlisted field/member reference and opaque request nonce. No generic arbitrary command event. Exit/outcome distinguishes validation refusal, canceled/paused, failed, unknown and verified success.

**Rejected:** `install.sh --add` as a component primitive (runs global phases); a lock only under the uncreated runtime home; a PID file as a mutex; resuming solely from the last log line; default-port liveness as installation identity; continuing later phases after editor closure.

## R8 — Secrets and writers

**Decision:** a single bounded UTF-8 JSON Lines input frame protocol over the engine's inherited stdin pipe, separate from native terminal onboarding. Human-entered secrets are only valid responses to an outstanding, run-bound secret request. Frames bind `runId`, `requestId`, installation/member ID and declared setting key; reject wrong/duplicate/expired requests, unknown fields, oversized frames, malformed UTF-8, CR/LF/NUL values and out-of-order replies. The engine never echoes frames. The assistant broker does not accept or return a secret value; the extension obtains it in a native password input and forwards it directly. Interactive native harnesses own their terminal credential prompts and are verified after return.

No shell command construction, argv value, temporary answer file, webview state, assistant context, journal or report receives a secret. Avoid inherited ambient provider/integration credentials in helper processes: construct a narrow host/process environment and inject only the selected scope. `setup.ts:setupEnvironment` already removes target selectors, but retains unrelated secrets from `process.env`; the new setup protocol must tighten this without breaking PATH/proxy/CA settings. Proxy values can themselves contain credentials and must not be serialized into review output.

Reuse `scripts/write-env.py:update`, `quote`, `write_private` and the existing single-line dotenv format. The writer reads values from stdin, treats dotenv as data, rejects symlink/nonregular leaf targets, creates private temporary files, flushes, `fsync`s, chmods 0600 and atomically replaces the target. `ui/netclaw-visual/src/security/private-files.js` provides analogous Node behavior. `os.replace` is atomic on success but can fail across filesystems; therefore temporary files stay in the destination directory. [Python os documentation](https://docs.python.org/3/library/os.html#os.replace).

Current writer limits: there is no per-file interprocess lock or expected-revision precondition; parent-component symlinks are not rejected; parent directory permissions are only set on creation; the directory is not fsynced after rename. Address these in the enclosing transaction/path guard or add backward-compatible helper options. Atomic rename prevents a torn file, but does not prevent lost updates or prove power-loss durability.

Member environments must be generated from explicit canonical component/provider requirements and user-selected sharing, never by copying the Border `.env`. Keep separate secret references per member even when the human explicitly selects reuse. `scripts/in2n-member-home.py:provision_hermes` currently copies a set of multiple provider keys from the selected Border, and only permits `subnet`; it is not a general least-privilege Risk provisioning implementation. The OpenClaw branch's Anthropic-specific derivation is likewise not a universal provider adapter. R11 must replace/extend this behavior for explicit per-member provider/harness choices.

Redaction is an output construction boundary: prefer typed allowed fields and opaque local references over raw text. Test exact values plus JSON/shell escaping, percent encoding, URL credentials, multiline/chunk-boundary output, ANSI sequences and subprocess exception messages. Do not rely on a token-name regex, or store unsanitized “private” logs while claiming secrets never enter evidence. Default report exports also redact hostnames, IPs, usernames and paths; a separately reviewed detailed export may include those identifiers, never secrets.

**Rejected:** passing credentials as CLI options; shell-sourcing dotenv; automatic checkout `.env` import; whole-process environment inheritance; full Border-env cloning; persistent SecretStorage as an implicit credential cache (the selected spec uses memory + reviewed runtime env persistence, and resume asks again).

## R9 — Canonical catalog and completeness

**Decision:** use one versioned JSON canonical catalog (recommended `config/components/catalog.json` plus its schema), with ordered components, profiles, explicit skill joins, settings and surface aliases. Generate checked-in `scripts/lib/catalog.sh` from it so Bash 3.2 and historical `--list` do not gain a new runtime dependency. Generation must preserve all 110 IDs, order, names, descriptions and nine profile selections; record a digest and have `--check` fail on drift. The setup engine and extension consume JSON, never scrape shell.

Skill descriptions/requires metadata derive from the actual `SKILL.md` front matter with source-path/hash provenance, using a real YAML parser already available to development tooling rather than a bespoke regex YAML implementation. Generated skill descriptors can be included in the catalog build; setup reads JSON and does not need a YAML package. Skill-to-component/dependency assignments remain explicit reviewed joins because names and front-matter env references are not complete dependency declarations. Check all 237 current skill files exactly once. A skill with no installer-supported backend remains visible with an explicit unavailable/external prerequisite reason, never silently bundled under an unrelated component.

Required component fields: stable ID/order/category/title, purpose/when-to-choose text, supported-platform conditions and provenance, installer adapter and effect class, server IDs/access role, exact skill IDs, settings with required/optional/conditional expression and secret/data type classification, prerequisites/dependencies, documentation links with role and reason when unavailable, expected verification operation/level, tool/context estimate with method/date/source/confidence or explicit unknown, and maintainer/check date. Separate optionality, sensitivity and configuration state. A script path is not a user credential; an endpoint URL is private report data even when not a secret.

### Evidence priority and mapping strategy

1. Exact executable config: `config/openclaw.json`, `installer-access.json`, the component implementation/README and startup parser establish actual env names, defaults, transport and expected tools.
2. Installer/preflight/runtime policy supplies install function, interpreter/platform facts and version gates.
3. `.env.example` and `ENV_MAP` supply candidate fields/help, then reconcile to actual consumers. Neither can prove completeness or requiredness alone.
4. README tables and upstream links are useful human documentation; distinguish vendored upstream README from a NetClaw integration guide and require its referenced path to exist.
5. `verify-catalog-coverage.py` explicit exact/prefix rules seed server joins, then remove keyword fallback as a proof mechanism. In particular the `eve-ng-mcp-server` documented open finding must stay explicit; do not invent a catalog installer for it.
6. `in2n-profiles.py:PROFILE_MATCHERS` seeds profile suggestions only. Broad matches (`sdwan` includes Prisma; `paloalto` includes FMC) and any-of environment gating must not determine credential scope. Build exact member composition and all/any conditional requirements from canonical joins.

Current alias issues include `catc → catalyst-center` (wrong), `wiki → wikipedia/arxiv/context7` (the latter two are not installer IDs), `worldlabs-viz` versus `worldlabs-marble` (no explicit alias), and one card grouping multiple components (`thousandeyes`, `protocol`). `security`, `slack`, `webex`, `config-archive`, `asa` and `evpn` are not independently installable catalog components; represent their surface roles explicitly.

Explicit HUD-to-installer join seeds (all other equal IDs remain exact, never suffix-guessed):

| HUD card ID | Installer component IDs / disposition |
| --- | --- |
| `rag` | `rag-mcp` |
| `arista` | `arista-cvp` |
| `paloalto` | `panorama`; FMC stays with the separate `fmc` component |
| `nvd` | `nvd-cve` |
| `clab` | `containerlab` |
| `drawio` | `drawio-rfc` (two registrations, drawio and RFC) |
| `azure-network` | `azure` |
| `wiki` | `wikipedia`; explicitly classify arxiv/context7 as external/not installer selections |
| `thousandeyes` | `te-community`, `te-official`, preserving separate credentials/transports |
| `asa`, `evpn` | `pyats` capability views, not extra installs |
| `protocol` | `protocol`, `n2n`, with independent component selection |
| `worldlabs-viz` | `worldlabs-marble` |
| `catc` | `catc` (remove the invalid `catalyst-center` alias) |
| `security` | posture/settings surface, not an installable component |
| `slack`, `webex` | channel surfaces, not MCP components |
| `config-archive` | existing HUD capability surface; no catalog component exists, so assign explicit non-installer disposition until its backing dependency is verified |

Server-to-component joins must preserve existing explicit groups: `chkp-* → checkpoint`, `chrome-devtools* → chrome-devtools`, `twilio* → twilio`, `aap-* → aap`, `aws-* → aws`, `gcp-* → gcp`; exact names `drawio-mcp`/`rfc-mcp → drawio-rfc`, `sketchfab-mcp → threejs-viz`, `comfyui-mcp`/`topology-diagram-mcp`/`image-style-mcp → comfyui-viz`, `azure-network-mcp → azure`, `unreal-mcp → ue5`, `cisco-fmc-mcp → fmc`, `meraki-magic-mcp → meraki`, `thousandeyes-mcp → te-community`, `thousandeyes-official-mcp → te-official`, `elasticsearch-mcp → elastic`, and unchanged `memory-mcp`/`rag-mcp` IDs. Materialize exact registration arrays in generated data rather than leave open-ended prefix ownership (especially `nautobot-mcp`, whose golden-config/routing variants must retain their separate components).

The 39 installer IDs without an equal `ENV_MAP` key are: `analysis`, `arista-cvp`, `aruba-cx`, `azure`, `blender`, `claw-certs`, `containerlab`, `devnet-content-search`, `drawio-rfc`, `forward`, `hermes-hud`, `humanrail`, `in2n-production`, `ipfabric`, `memory-mcp`, `mempalace`, `n2n`, `nautobot-golden-config`, `nautobot-routing`, `nsm`, `nvd-cve`, `ollama`, `packet-buddy`, `panorama`, `peering`, `percepxion`, `rag-mcp`, `redfish`, `slc`, `subnet-calc`, `tavus-pal`, `te-community`, `te-official`, `tts`, `twilio`, `twitter`, `ue5`, `wikipedia`, `worldlabs-marble`. Some are resolved by aliases above; the remainder need metadata from their actual implementations. “No equal HUD key” is not proof they require no settings.

**Completeness gates:** 100% of actual catalog rows, callable/no-install adapters, current skill files, static MCP registrations and external integration declarations have an explicit disposition; all selected settings have source evidence, classification, requirement condition, help and safe example; every link role has an exact URL/path or explicit justified not-applicable state. Generic README links or “unknown requirement” copied across most cards do not satisfy the spec. Keep a machine-generated gap report and make missing required metadata fail CI. Runtime verification `unknown` remains valid, but authored metadata omissions do not become “complete” by labeling them unknown.

Local link existence and JSON/schema/joins/generator parity run in every PR. External links run on changed catalog entries in PRs and on a weekly scheduled all-catalog job, with bounded concurrency, TLS verification, redirect cap and no credentials. Treat 401/403/429 as needs-review/retry rather than dead-link proof; distinguish timeout, retired URL and confirmed 404/410. Pin source references to the selected source commit where possible. Record last-checked date/status, never suggest an unchecked link was verified. No runtime request to arbitrary metadata URLs is necessary merely to display a card.

**Rejected:** duplicating metadata into the wizard, assistant skill and TUI; dynamic shell scraping; inferred suffix-only joins; counting every item in `workspace/skills`; claiming completeness from the current 14 access records; generating secrets or example real endpoints from the host.

## R10 — Shape Advisor

**Decision:** explain a recommendation; never change shape, create members or infer credential sharing automatically. Use the actual selected component/skill/server set. The catalog carries per-registration tool counts with provenance and distinguishes tool **schemas** from callable API **operations**. Catalyst Center is the clearest counterexample: 514 operations are grouped behind 8 dispatchers plus 2 discovery tools, not 514 always-loaded schemas (`ENV_MAP.catc` and `mcp-servers/catc-mcp`). Counting capability descriptions as schemas would overstate context.

For unavailable measurements, use the historical illustrative **150 tokens/schema** model from `docs/N2N-RISK.md`, show an estimate range (e.g. ±50%), include unknown-count components explicitly and show the source/date. Do not add skill body byte counts as exact tokenizer counts. A measured schema/token count for a known runtime/version overrides an estimate only for that exact evidence scope. The 194-skills/52-servers/~2,755-tools historical snapshot remains a labeled reference example, never the current selected total.

Recommended deterministic initial advisory rules (product heuristics, **not** externally measured limits):

- Focused: at most 8 selected components, at most 50 known schemas and one user-declared credential trust domain, provided unknown coverage is small.
- Compare both: 9–20 components or 51–150 schemas, or substantial unknown estimates. Explain uncertainty and expected member/service overhead.
- Recommend a Risk: over 20 components or over 150 known schemas, or more than one explicitly declared credential trust domain requiring separation. Show at least one feasible partition with Border/member counts and per-member estimates.

These thresholds are transparent defaults in one versioned advisor policy, tested on fixed small/medium/large/unknown fixtures. They do not claim model context exhaustion, lower total bill or better accuracy. A Risk adds routing calls, member processes, more installation/state and may increase end-to-end cost/latency. Trust domains come from operator declarations (credential owner/account, permission boundary, environment), not vendor names, endpoint IP ranges or assumed credentials. Dependencies and shared infrastructure capabilities cannot be split across members solely to hit a number. The user may choose either valid shape, with documented rationale.

**Rejected:** current universal 15–30× savings claims; tool count inferred from README marketing text; vendor equals trust domain; a fixed maximum tool threshold treated as a harness limitation; estimates with no unknown category.

## R16 — Cleanup

**Decision:** cleanup is an engine-owned reviewed operation over recorded artifacts, with a separately hashed preview. It is not “uninstall NetClaw” or recursive deletion of the selected root. Persist ownership before creating each artifact and inspect it after. Record canonical path/resource ID, class, run/installation ID, preexisting state, created revision/hash (never the secret bytes), last verified revision, and references by other installations.

Order: stop only verified owned running processes/services → unregister only owned services/connections → retire run-owned registrations/config generated by this run → remove owned runtime/dependency artifacts still matching recorded identity → remove run-created empty directories → optionally remove this run's clean acquired checkout if no installation references it. Keep a redacted tombstone/report and any operator recovery artifacts. A process ID alone, a familiar filename or directory containment is not ownership.

Refuse or leave for manual review: pre-existing files/directories; changed/unrecognized content; symlink traversal; foreign ownership; sources/binaries/venvs shared with another claw; OS prerequisites or version managers; package-manager caches; external accounts/channel resources; source trees with local edits; user credentials/history; files created while the run was absent without corresponding owned effect evidence; unknown process/service state. A secret-file hash can establish revision without exposing content; report neither content nor secret-derived low-entropy hash details.

Use controlled filesystem APIs with descriptor/ancestor checks, not arbitrary `rm -rf` shell strings. Cleanup after a partial source acquisition is allowed only when this run created the destination and identity/revision checks still hold. If cleanup cannot prove safety, report preserved artifacts and reasons; do not report complete removal.

**Rejected:** deleting a whole runtime home because its name matches; uninstalling shared global harness/package prerequisites; treating an unchanged git working tree as proof no claw uses it; rollback of unknown provider/channel effects.

## R4/R5 supporting decisions and external evidence

- `config/installer-runtime.json` currently distinguishes OpenClaw Node `>=24.16 <25 or >=26.1` from HUD `>=24.19 <25 or >=26.1`; Hermes Node `>=18` only describes Node-based components, not the complete HUD requirement. Bootstrap must calculate the selected capability intersection and show that policy source, not advertise a single generic Node 18 minimum.
- `core_prereqs` requires `python3` before several policy operations and assumes the checkout already exists. The extension bootstrap cannot simply call it on a zero-install host. Its remedy scripts can replace global system Node; detect nvm/fnm/volta-resolved paths and stage an appropriate user-visible remedy instead of silently overwriting them.
- Homebrew's current language-runtime guidance says its Python/Node versions may be upgraded by dependency operations, recommends version managers when users need version control, and directs non-Homebrew Python packages into virtual environments. [Homebrew language runtimes](https://docs.brew.sh/Language-Runtimes-and-Packages). Treat Homebrew Python as a selectable base interpreter, not a target to mutate with pip.
- Python's externally-managed specification uses the `EXTERNALLY-MANAGED` marker to direct package tools toward virtual environments rather than the interpreter's global environment. [PyPA specification](https://packaging.python.org/en/latest/specifications/externally-managed-environments/). Preserve the existing `pip-helper.sh` isolation rule and never add `--break-system-packages` as a remedy.
- npm recommends a Node version manager for global-install permissions errors and also documents a user-owned prefix; its worked test uses no sudo. [npm permission guidance](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally/). Keep `runtime-install.sh`'s no-sudo behavior; scope any new prefix to the selected run/install rather than silently changing global npm config.
- uv may download a required Python automatically; `--no-python-downloads` disables that during a probe. [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/). Read-only prerequisite checks must use no-download behavior; downloads become disclosed effects. Existing pyATS/GAIT/companion isolated interpreter policies remain separate from the engine's own Python.
- GitHub's latest-release API returns a published non-draft, non-prerelease release and can be used without authentication for public resources. Its release selection/date semantics are not equivalent to “highest git tag.” [GitHub release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release). On rate-limit/API failure, a git-tag fallback must visibly say tag-only fallback and not claim the official latest release was verified; require reviewed ref selection or retry. Pin the resolved commit in the plan/review before code execution.
- `common.sh:clone_or_pull` is a component acquisition helper, not a trusted NetClaw source bootstrap. It may `git pull` an existing directory and continue after pull failure. Do not use it for origin/ref/commit verification of the engine source. Source acquisition requires a fixed expected origin, checked ref/commit, dirty-state disclosure, shared-install detection and a nonexecuting protocol manifest before loading repository code. Proxy/CA configuration may be inherited safely, but never bypass TLS verification or put proxy credentials in plan/evidence.

## Required plan/task changes from this research

1. Correct the skill baseline and make component/function/skill counts artifact-derived; fix checker phantom ID and missing `k8s` installer disposition.
2. Expand M1 beyond metadata extraction: exact joins, all 237 skill dispositions, field evidence/conditions and real per-component adapters are required.
3. Add an explicit per-component effects audit before the engine bridge is enabled; all later implementation milestones depend on it.
4. Add source checkout/shared runtime/host resource preservation to multiclaw design, not just home/port/service names.
5. Split unsafe global/interactive `core_*` paths, checkout-env import, skill deployment and shared inventory semantics for plan execution while preserving legacy CLI behavior.
6. Add selected-install readiness identity checks and retain `unknown`/`configuration_required` rather than inferring success from exit 0 or a default listener.
7. Specify provisional outside-home journal, multi-resource locking, effect-specific resume probes, pause-on-editor-loss and reviewed cleanup ownership in contracts.
8. Complete member scoped credential derivation and generic profile support; current Hermes subnet-only helper is a real capability gap, not a testing detail.
9. Keep advisor thresholds as explicit heuristics and historical token figures as estimates; add unknown and operation-versus-schema tests.
10. External catalog links require current validation during implementation; this research did **not** validate every upstream link or installer against a clean host. macOS/WSL live provisioning, provider/channel tests, Windows gate hosts and usability participants remain acceptance work, not claims supported by source inspection.
