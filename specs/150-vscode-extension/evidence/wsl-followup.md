# WSL qualification — Mac replacement review pending

Current result: the final Windows/WSL OpenClaw matrix is qualified with the
recorded limitations. Use `artifacts/netclaw-0.1.0-wsl-fixes.vsix`, SHA-256
`f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`.
See **Final Windows/WSL disposition** below for the consolidated matrix and
[mac-return.md](../mac-return.md) for next steps. Mac replacement qualification
and publication remain pending.

The earlier sections preserve the initial blocked checkpoint and subsequent
observations chronologically; their past-tense scope statements are historical.

## Initial HUD-repair checkpoint (preserved)

Observed 2026-10-11 on the owner's existing Windows/WSL installation. This is a
checkpoint for continuation, not release acceptance. The original
[WSL evidence](wsl.md) and [structured report](wsl-checks.json) are unchanged.

Incoming review: `4e3cd2627ac80b7d160af7b135d30dec6580f202` on
`150-vscode-extension-wsl-review-20261011`, with prior return `1aaaafa` as an
ancestor. Work uses isolated branch `150-vscode-extension-wsl-followup-20261011`.
Owner source remains `aa2795313b487e00ccbe85d53f6a78db07b10a94`; its pre-existing
testbed modification and backup are preserved.

The exact committed `NetClaw.netclaw@0.1.0` VSIX is unchanged:

```text
specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix
SHA256 71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005
2220783 bytes
```

No extension or NetClaw source changes, new package build, merge or publication
were performed. The previously passing source suite was not repeated.

## Approved HUD prerequisite repair

The owner explicitly authorized the bounded repair in
[wsl-prerequisite-recovery.md](../wsl-prerequisite-recovery.md). That approval
supersedes the prior session's instruction to leave the unavailable HUD alone.

Before applying, observed the real unit and its dependencies, selected runtime,
existing installation identity, Node/npm/OpenClaw executables, package/lockfile,
available space, protected files and services. The HUD unit had no stop propagation
to other application services. Its dependency directory was owned and not a symlink.
The package and lock matched the reviewed source and already pinned the MCP client.

Staged copies of the two package files on the same filesystem, then ran the
existing Node 24.19.0 executable with the existing npm CLI:

```sh
"$HUD_NODE" "$HUD_NPM_CLI" --prefix "$HUD_DEP_STAGE" ci --ignore-scripts --no-audit --no-fund --include=dev
```

The stage explicitly included development dependencies needed by the unchanged
`npm run dev` service. Its lockfile stayed identical. Imports of
`@modelcontextprotocol/client` and `@modelcontextprotocol/client/stdio` passed;
Vite and concurrently entry files were present. No unrestricted install scripts
or global package/runtime upgrades were used.

Confirmed the HUD was idle with no established connections on its two ports,
stopped only `netclaw-hud.service`, and verified its ports were free. Renamed the
old dependency tree to `node_modules.spec150-backup-20261011-0805` beside the HUD;
renamed the staged tree into place. The backup is deliberately retained and appears
as an untracked directory in the owner checkout. Do not commit or remove it.

Added only the HUD unit drop-in `50-spec150-supported-node.conf`: it prefixes PATH
with the existing supported Node directory and runs that Node with the existing
npm CLI and unchanged `run dev` arguments. The original unit, working directory,
remaining PATH entries, runtime/home and ports are preserved. OpenClaw resolves
to the same executable before and after. Saved original unit bytes/mode and a
rollback helper before applying; rollback was not needed. It would restore the
prior **degraded** dependency/runtime state, not a working HUD.

After a user-systemd daemon reload, started only the HUD. The actual API,
concurrently and Vite child executables all resolve to Node 24.19.0. The existing
native installation identity and selection descriptor are unchanged.

| Probe | Actual result |
| --- | --- |
| `GET /api/runtime` | HTTP 200; existing OpenClaw identity; `readiness.ready=true`, `executionVerified=false` |
| `GET /api/gateway/status` | HTTP 200; online, reachable and chat completions enabled |
| Protected file observations | All 12 unchanged, including credentials/configuration, testbed/backup, assistant configuration, identity, actual selection descriptor, package and lock |
| Core services | Gateway, mesh, four members and security service identities unchanged |
| Other services | HUD changed intentionally; two scheduled DDNS services and the already-restarting Zoom RTMS service changed naturally |

This proves the repaired API prerequisite. It does not prove a provider answer or
the extension's live UI workflows.

## Fresh API observations and separate RAG prerequisite

Seventeen bounded GET requests used the actual native installation header. Fifteen
returned HTTP 200. Native federation, graph, runtime, configuration, tokenomics,
budget, security, OpenShell, documentation, reference, logs and endpoint-inventory
responses were available. The structured report records routes and field/count
observations without configuration contents, private identities or topology.
These are API observations; no rendered-panel acceptance is claimed. Empty fields
and an HTTP 200 response alone do not establish feature health.

Both `GET /api/rag/stats` and `GET /api/rag/documents` returned HTTP 500:

```text
No response to initialize
ModuleNotFoundError: No module named 'fastmcp.utilities.async_utils'
```

Read-only launcher inspection establishes that the current RAG command does not
match a managed component binding. It runs the system Python 3.14.4 and sees
FastMCP 2.14.7 / MCP 1.28.1. Existing `mcp-servers/rag-mcp/pyproject.toml` requires
FastMCP 4.0.11, fastmcp-tasks 4.0.11 and MCP 2.3.0. The source imports the missing
module during startup. This is a reproduced installation prerequisite failure;
no extension defect is established by it.

No Python package/runtime/launcher repair was made: that is outside the approved
HUD Node/dependency repair. A concrete, separately reviewed runtime correction is
needed before RAG acceptance. No upload, search, reindex or deletion was submitted.
The GET routes did start the existing RAG process, whose native startup can perform
its own integrity work; this report does not assert a byte-level corpus comparison.

## Windows editor prerequisite

Windows still reports build `26300.9550`; the installed VS Code executable reports
1.140.0. Existing Remote WSL is 0.104.3, WSL 3.0.1.0, Ubuntu 26.04 LTS, kernel
`6.18.40.1-microsoft-standard-WSL2`. The distribution's older display label is not
used to infer its OS version. Boot identity stayed the same throughout this repair.

Prepared separate Windows user data/extensions and a private WSL server-data and
extension directory. The server CLI installed the exact VSIX there successfully.
Both this private install and the owner's preserved install match all 21 packaged
payload files; manifests match after excluding editor-added metadata.

A temporary conditional `server-env-setup` hook was prepared to select private
WSL storage only for a marked test launch. A workspace observer was prepared to
verify the actual extension host and storage location without replacing product
code or consent handlers. One normal isolated Windows launch exited **255** before
writing a session log; the observer did not run. A subsequent read-only Windows
inspection found live VS Code updater processes and the `vscode-updating` mutex
still present. The silent exit alone does not establish its exact internal cause.

The owner was asked to save work and complete the update through its normal UI.
No window/updater was terminated, lock removed, mutex check bypassed, or WSL
shutdown requested. The conditional hook was checked against its recorded hash
and moved back into private evidence, restoring its original absence. Preparation
files remain private for continuation. No launched-host storage isolation, upgrade,
disable/re-enable or uninstall result is claimed.

## Remaining matrix

| Required check | Follow-up disposition |
| --- | --- |
| Exact VSIX installation / WSL activation | Prior real-host activation stands; private install and payload comparison passed here; new observer did not run |
| Connection, native identity review, host placement | API identity/readiness verified; actual editor binding and visual Running Extensions check pending |
| Populated panels | API observations recorded; actual panel rendering pending |
| Real provider Chat, history, model/context choices | Not attempted in this follow-up; isolated editor prerequisite blocked |
| Canvas branch/save/reopen/export/import, Avatar | Pending actual editor session |
| RAG upload/index/citation/context | Blocked by reproduced Python dependency mismatch and editor prerequisite; no fixture substituted |
| Settings cancellation, service command staging | Pending actual editor session; no owner setting/lifecycle write submitted |
| Other harnesses | Only selected OpenClaw observed; no harness switch or Hermes qualification claimed |
| Copilot / Claude Code / Codex interactive consent and tools | Not attempted; no extension opt-in, registrations or delegated provider requests created |
| Reconnect, stale views, trust, identity/host separation | Pending actual editor session; no owner restart/second-host test substituted |
| Upgrade / disable / re-enable / uninstall | Blocked before launched WSL storage isolation could be verified; owner install preserved |
| Preservation | 12 protected file observations unchanged; same boot; core service identities retained; approved HUD changes explicitly enumerated |

**T022 and T023 remain open. No release acceptance or publication is authorized
by this checkpoint.** Resume after the Windows update completes normally; address
the separate RAG prerequisite within a reviewed scope. Do not repeat dependency
replacement or the passing source suite merely to resume.

## Audit and private evidence

GAIT branch `spec150-wsl-hud-repair-acceptance-20261011` was created and checked out.
Startup inventory listed five entries with `pyats_list_devices`; no device-health
or configuration call was made. Milestones: `a55e3a31` startup, `8ea7cb80` baseline,
`c909efc7` repair verification, `82d8b900` editor/RAG prerequisites. Session-end audit
and daily memory accompany the checkpoint; MemPalace is unavailable here.

Raw observations, service backup, rollback helper, failed launch log, prepared
observer and private installed VSIX remain under the owner's private follow-up
cache. No credentials or raw network responses are committed. See
[wsl-followup-checks.json](wsl-followup-checks.json) and the updated
[Mac return](../mac-return.md) for the exact transfer checkpoint.


## Post-update continuation — 2026-10-11

This section supersedes the prerequisite and unattempted-check status of the
checkpoint above. The original checkpoint and prior `evidence/wsl.md` are retained
as historical evidence. The artifact remains byte-identical; no product source was
changed or rebuilt.

### Windows editor and real provider

After the owner completed the normal update, Windows VS Code **1.141.0**, commit
`2a59476c9bfcb90b3ddc372c36762471b7dfad1c`, launched successfully through the
Windows CLI with separate Windows user data/extensions and a conditional private
WSL server-data directory. No updater process or update mutex remained. The
observer in the actual Windows desktop's remote host reports `platform=linux`,
`remoteName=wsl`, and private extension/storage paths. The installed NetClaw payload
is the exact candidate. Developer: Show Running Extensions visibly lists NetClaw.
The shared immutable server executable does not imply shared extension storage.

A temporary, hash-recorded `server-env-setup` hook selects the private WSL data
root only for the marked validation launch. Owner launches without that marker
retain their defaults. This hook must be restored to its original absence when
validation ends; it remains in use while the private window is open.

The native connection flow created an owner-private profile bound to the existing
OpenClaw installation identity. The saved profile survived reload and reconnected.
The installation-binding dialog itself was not captured, so its visual review is
not independently evidenced. A harmless Chat question returned the actual provider
answer `SPEC150_WSL_CHAT_OK`. Owned history reopened that answer, ten model choices
were displayed, and selecting the configured default created a separate empty
conversation. No device command was requested. After disconnect, the old Chat view
reported the connection change and disabled Send.

Twenty-one domain panels returned observed results in their webviews; Knowledge
reported the then-existing RAG dependency failure. These first DOM observations
occurred behind the editor onboarding overlay and are not final visual-panel
acceptance. The overlay was subsequently dismissed normally. Fresh visible RAG,
panel and context checks remain to be recorded.

### Separately approved RAG prerequisite repair

The owner explicitly approved the concrete private plan with **“Apply this bounded
RAG repair.”** A dedicated Python **3.12.10** environment was prepared from the
existing RAG dependency requirements, with FastMCP/tasks **4.0.11**, MCP **2.3.0**,
ChromaDB **1.5.9** matching the installed corpus version, and CPU-only Torch
**2.13.0+cpu**. Its exact resolved dependencies are retained in a private lockfile;
`uv pip check` passed. No global Python package or source was changed.

Before activation, actual ingest/search returned a citation for a harmless fixture
in a disposable corpus. Separately, a stable backup of the existing owner corpus
and a second compatibility copy were retained; native listing/statistics succeeded
on the compatibility copy. These are prerequisite checks, not live extension RAG
acceptance. The owner corpus contained one document and 1,055 chunks.

Activation added only `60-spec150-rag-runtime.conf` to the HUD user-service drop-ins.
It prepends a private dispatcher after the already-approved Node directory. The
dispatcher selects the dedicated interpreter only for the exact existing RAG
server invocation (`python3 -u` with its observed absolute script path); every
other Python invocation falls through to the original system interpreter. The
existing Node drop-in, HUD command, source, credentials, runtime selection and
OpenClaw CLI resolution are preserved. Service/corpus backups and a rollback helper
that removes only this new drop-in remain private. Corpus rollback is not automatic,
to avoid overwriting later owner writes.

The extension disconnected first; no active RAG process or established connection
to the HUD ports was observed before the bounded restart. Only the idle HUD was
stopped/started. Live gateway status, RAG listing and RAG statistics then returned
HTTP 200. The native installation identity and all 12 protected file observations
were unchanged. Gateway/federation/member/security identities were unchanged; the
HUD changed intentionally and the already-restarting Zoom RTMS service varied
independently. System Python still reports its original packages. Rollback was not
needed. The retained runtime/dispatcher are now service dependencies and must not
be removed as disposable test cache while this drop-in is active.

### Current acceptance boundary

Actual Chat/provider, history/model choice, saved-profile reload/reconnect, remote
host/storage placement and stale Chat disabling are now evidenced. RAG's runtime
prerequisite is repaired. Native extension upload/index/citation/context,
Canvas/Avatar, settings cancellation, trust/identity/host negatives, interactive
Copilot/Claude Code/Codex and installed lifecycle remain open. Copilot sign-in in
the isolated Windows window has been requested through its normal UI; default
consent settings remain intact. No assistant registration or delegated assistant
request has been created at this point. T022/T023 remain open.

Current GAIT branch: `spec150-qualification-unblock-plan-20261011`, created and
checked out. Records include `2fac6b7e` startup, `c775f650` approved RAG prechange,
and `f2969ada` verified repair/live UI progress. Disposable RAG ingest also produced
its native GAIT record. Raw screenshots, transcripts, corpus backups and paths
remain owner-private. No raw topology, credentials or private corpus names are
included here.


### Live RAG and interactive assistant progress

The owner completed Copilot sign-in normally. Native file selection/category and
upload review sent the 398-byte harmless fixture
`spec150-wsl-rag-20261011-b7a3d92e.md`, SHA-256
`d53b67547758ade86987aa0e0403fdb35abff20c9249ee8fc6623c23d2c4f8fa`.
The real index reports document `doc_0e84d3b40932`, `ready`, one chunk. The fixture
is intentionally retained for owner review or a separately requested removal.
No corpus deletion/reindex was requested. Both live API and actual extension
search returned its citation and expected text. Only that harmless result was
selected and staged through the native context review. A Chat/Canvas context send
has not yet completed; the tab-return defect below interrupted that workflow.

Copilot's actual discovered inventory contained exactly `netclaw_status`,
`netclaw_inspect`, `netclaw_propose_change`, `netclaw_request`, and
`netclaw_request_status`. No apply/approval/raw-shell/HTTP tool was exposed.
Status and knowledge inspection succeeded (two documents, 1,056 chunks). The
owner reviewed the native opt-in, allowed the inert draft, and explicitly allowed
the harmless delegated request. It returned `SPEC150_COPILOT_WSL_OK`, completed.
After this run, the editor permission picker was observed as **Allow all**; the
mechanism that selected it was not established. It was restored to **Default
permissions** before further requests. A new, completed-request-safe consent check
in a fresh conversation returned `SPEC150_COPILOT_DEFAULT_OK`; the owner used the
result-review dropdown's **Allow Once**, and Default permissions remained selected.
The deviation is retained here rather than claiming uninterrupted default settings.
After native registration disable, Copilot's cached status attempt was refused
because the tool no longer existed in its catalog. It did not reconnect or retry.

Codex CLI **0.162.1** ran interactively with on-request approvals and a read-only
shell sandbox, using per-process MCP configuration. It listed the five tools,
read status/knowledge and created an inert draft. Its native request-consent prompt
was relayed to the owner, who authorized **Allow once** for the specific harmless
request. The actual answer was `SPEC150_CODEX_WSL_OK`; its same-ID status was
completed. After native extension disable, the still-running cached MCP client
received `Assistant registration is disabled. Enable it in the NetClaw extension.`
No owner Codex configuration was edited. An initial validation-launcher quoting
error prevented startup; correcting that private launcher was not a product fix.

Claude Code **2.1.288** ran interactively in manual mode with a session-only,
strict MCP configuration. The owner approved its private test-folder trust prompt
and one use each of status, knowledge inspection and the inert draft. Those checks
passed. Delegation and cached-disable acceptance are still in progress. Its native
updater reported an update staged for a later restart; this session did not invoke
an update command or restart it to upgrade. Normal CLI bookkeeping and the
explicitly approved test-folder trust must be distinguished from protected
credentials in the final preservation comparison.

### Confirmed extension defect and replacement preparation

The exact original VSIX reproducibly loses communication when a webview tab is
hidden and revealed. With a fresh Chat panel, the observed status was
`Ready for an explicit request.`. Opening Overview and returning to that same Chat
left it at `Loading owned conversation…` after five seconds. The same failure was
observed during normal tab changes while exercising the RAG context flow. No
provider request was sent by the failed context-send attempt.

VS Code recreates hidden webview scripts. The original frontend counters restarted
at zero while the extension host retained its monotonically increasing replay
guard. The restored `ready` and following actions were therefore discarded.
The extension-only correction persists the counter using VS Code webview
`getState`/`setState`, scoped to the panel's existing view ID. Chat/Avatar, RAG,
Canvas and data panels use the same small helper. It stores only the view ID and
counter, not drafts or reference contents. Host sequence checks, identity binding,
workspace trust, native review and backend approvals are unchanged. This follows
[VS Code's webview state lifecycle](https://code.visualstudio.com/api/extension-guides/webview#persistence)
without retaining every hidden document in memory.

Supported-Node type checking and build passed. Source tests: **18 passed, zero
failed, one optional RAG fixture skipped**. New tests exercise a destroyed/recreated
frontend and a separate panel identity; the editor regression also covers returning
to existing Overview and Chat tabs. The actual original Windows/WSL reproduction
is recorded separately from these fixture/source checks. Packaged replacement
regression and remaining live acceptance are pending. The original VSIX is retained
unchanged; it is not qualified for publication with this defect. A replacement will
be packaged from the clean committed source and identified by a new digest.

GAIT `2f646369` records the defect and assistant progress. The owner's separate
question about creating/uploading/editing `testbed.yaml` through pyATS MCP is
recorded as follow-up scope; no pyATS/backend implementation was added to Spec150.

### Replacement package and completed assistant checks

The extension fix is committed in `153e4f7238b4bdc737e06556217f361a03b6877e`.
A clean-source package is retained as
`artifacts/netclaw-0.1.0-wsl-webview-fix.vsix` (2,349,138 bytes; 25 files),
SHA-256 `d26a8d3bc08b9fcb69fa891bc7a6678ae998d119e6783bc533f47499e1170fee`.
The original VSIX is preserved unchanged. Only the intended webview payloads,
changelog and committed-source README links differ. `dist/assistant.mjs` is
byte-identical. Installed payloads match the replacement ZIP, excluding VS Code's
added package metadata. The private Windows editor was reloaded; actual host
observations still place the extension and storage in the isolated WSL directory.

The original Chat tab-switch reproduction now passes on the installed replacement:
ready before hiding, ready after revealing, refresh accepted and history unchanged
without a new provider request. All 22 domain observation panels rendered and
accepted actual refresh clicks with the onboarding overlay dismissed. Rendering
is not a claim that every underlying feature is configured or healthy. RAG also
restored its collection listing after hiding/revealing; a fresh search retrieved
the retained fixture citation and native review staged it locally.

Claude Code completed its harmless delegated question under manual permissions
after the owner's explicit one-time consent. It returned `SPEC150_CLAUDE_WSL_OK`;
`netclaw_request_status` for `spec150-claude-wsl-20261011-b7a3d92e` reported
`completed` with the same answer. After the actual extension disabled its
registration, a separately consented cached status call returned the disabled
registration error. All three test registrations are now disabled. Both owned
terminal clients exited normally. These interactive results used the original
loaded adapter process; its payload is byte-identical in the replacement.
Copilot's earlier permission deviation and subsequent default-mode check remain
part of the evidence and are not erased by these successes.

GAIT record `b0726e0c` records these checks. Remaining replacement matrix and
Mac qualification are still pending; no merge or publication occurred.

### Live context, Canvas/Avatar and management checks

On the first replacement VSIX, explicit selection of the reviewed RAG fixture and
a harmless editor selection produced the actual Chat answer
`APRICOT_B7A3D92E SELECTED_WSL_C8F2`. An initial UI automation attempt selected
the citation preview instead of the intended file; a pre-send assertion caught
that, so no request was sent. The native file picker was then used explicitly
and the correct selection staged. Only the two intended references were checked
for the actual send; the duplicate local citation was not sent.

Local Avatar rendered both bundled characters and preserved this conversation.
Canvas sent only the reviewed citation through the real provider and returned
Thursday at 14:20 UTC. Branch/save/reveal/open retained two lanes. Native export
created a Canvas v1 document; native import restored both lanes to Ready with no
execution bindings or automatic submission. The export remains in private evidence.

Environment and budget native final reviews were both cancelled. The environment
input used an explicitly fake test string; the old secret was never read. Budget
configuration compared equal before and after. An existing-owner HUD status command
was reviewed and staged in a new terminal without Enter, then cleared with Ctrl+C.
The actual terminal screenshot shows the cancelled command and a fresh prompt.
No lifecycle command was executed against the owner HUD.

### Second confirmed extension defect: Windows-local guidance

A separate private Windows-local VS Code 1.141.0 host loaded the installed first
replacement (actual platform win32, no remote host, separate extensions/storage).
After dismissing its normal onboarding without sign-in, Add Connection opened
the entire command palette with input `>` instead of filtering to WSL commands.
The existing call to `workbench.action.showCommands` ignored its filter argument.
No connection/profile was created or backend operation executed. The confirmed
extension-only correction uses `workbench.action.quickOpen` with `>WSL:` and
shows explicit WSL workspace guidance. Check/build and the 18 source tests passed
again (one optional RAG fixture skipped). A new package and actual Windows retest
are required; the first replacement is intermediate evidence, not the final VSIX.

### Final candidate and actual host boundaries

Both fixes are in source commit `7b4ebee3cf819aeab86622606eb9afc729a7748b`.
The clean-source final candidate is `artifacts/netclaw-0.1.0-wsl-fixes.vsix`,
SHA-256 `f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`,
2,349,236 bytes, committed in `79b94f80`. It differs from the intermediate
webview-fix package only in the extension bundle's Windows guidance branch,
changelog and committed-source README links. All webview resources and the
assistant adapter are byte-identical to the intermediate package. The original
and intermediate VSIX files remain available for review; neither is the release
candidate now.

The exact final candidate loaded in the private Windows-local host and passed
the corrected Add Connection boundary: explicit WSL workspace guidance, palette
input `>WSL:`, no saved profile or backend execution. A separate normal Windows
VS Code window (not an Extension Development Host) opened an empty private WSL
folder in Restricted Mode. Actual Add Connection refused with “Trust this
workspace before connecting.” No trusted-parent entry was removed or changed.
The extra boundary-test windows were closed normally after observation.

A synthetic 0.0.0 package, derived only for the upgrade test, loaded in the
private WSL host and reconnected the existing saved profile. Upgrade to the exact
final 0.1.0 candidate retained that profile and reconnected the live installation.
Native Disable plus window reload removed the target from the extension host.
The remaining re-enable/uninstall checks are recorded below when complete.

The native service form also rejected a separately created private identity
fixture with “Selected home belongs to a different installation.” This is a
fixture boundary check, not qualification of a second real installation.
All 12 protected file observations compared unchanged across the cancelled
management reviews. The HUD, gateway and core federation identities stayed
stable; scheduled DDNS and already-restarting Zoom RTMS identities varied
independently. GAIT `9fe859f9` records this milestone.

## Final Windows/WSL disposition — 2026-10-11

**The final candidate is qualified for this existing OpenClaw Windows/WSL scope,
with the explicit limitations below. Mac must review and requalify this replacement
before publication.** T022 is complete for the recorded scope; T019 is reopened
for the replacement on Mac, and T023 remains open. No merge or publication occurred.

| Handoff area | Actual result and evidence boundary |
| --- | --- |
| Exact package and host | Final SHA-256 `f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`; Windows VS Code 1.141.0 with the installed extension and private storage in WSL. Installed payload matches the ZIP, allowing only VS Code metadata in package.json. |
| Binding and reconnect | Native review of the real installation matched its original pin. A temporary review profile was removed; the primary saved profile reconnected after reload and lifecycle tests. |
| Windows local and trust | Final Windows-local Add Connection displays WSL guidance and `>WSL:`. A separate normal Windows/WSL window in Restricted Mode refused Add Connection. No trusted-parent entries changed. |
| Populated observations | All 22 domain views rendered and accepted actual refresh clicks on the exact final candidate. Data/optional-feature limitations remain explicit below. |
| Chat and selected context | Exact final candidate returned `SPEC150_FINAL_CHAT_OK APRICOT_B7A3D92E SELECTED_WSL_C8F2` from the selected RAG citation and selected editor text through the real configured provider. Prior owned history, new-conversation and 10 model-choice checks are retained. |
| Canvas and Avatar | Final candidate rendered both local characters with the same conversation. A real Canvas context request returned `SPEC150_FINAL_CANVAS_OK` and Thursday 14:20 UTC. Save/reopen/reveal/export/import passed; imported lanes returned to Ready without execution. The earlier branch check created the two retained lanes. |
| RAG | The original native reviewed upload actually indexed one fixture chunk. Final candidate inventory showed it ready; actual retrieval returned its citation, native review staged it, and explicit Chat/Canvas sends used it. No broad deletion or reindex. |
| Settings | Real-owner environment/budget final reviews were cancelled. On the final candidate, actual native Apply against an isolated unchanged HUD fixture replaced a fake environment value and budget field, verified results and preserved unrelated fields. No owner setting was written. |
| Service commands | Real-owner HUD status command was reviewed and staged without Enter, then cleared with Ctrl+C. A private mismatched identity fixture was refused. No owner lifecycle command executed. |
| Assistants | Actual signed-in Copilot, Claude Code and Codex inspected, created inert drafts, delegated harmless questions and inspected results. Normal native consent was used; Copilot's deviation and default-mode follow-up remain recorded. All registrations were disabled and cached calls refused. Adapter bytes are identical in original and final VSIX. |
| Stale work and mismatch | Final candidate refused a saved pin after an isolated unchanged HUD was restarted with an alternate test identity. A pending observation against a paused isolated fixture became disabled on disconnect. Final disconnect from the real owner also disabled Chat Send. No owner identity/process was changed for these negative tests. |
| Installed lifecycle | Actual private WSL host: synthetic 0.0.0 → exact final 0.1.0, native disable/re-enable, native uninstall, absent host/CLI inventory, exact reinstall. All 20 extension state files survived uninstall byte-for-byte; saved profile/reconnect survived. |

### Final preservation and cleanup

The owner checkout remains at `aa2795313b487e00ccbe85d53f6a78db07b10a94` with
its pre-existing testbed edit and backup, plus the deliberately retained HUD
node_modules rollback directory. Source, testbed content, observed credential
files and native installation identity are unchanged. The owner extension payload
still matches the original VSIX; the validation install matches the final VSIX.
All 12 protected observations stayed unchanged across management/lifecycle tests.
Across the longer interactive session, 11 of 12 match the pre-RAG baseline;
`.claude.json` changed during the signed-in CLI session that included the owner's
explicit private-folder trust approval. The exact pre-session backup was
unavailable, so a complete field-level diff or attribution of every changed
field to client bookkeeping is not claimed.
Codex's global configuration hash is unchanged. No global MCP registration command
or approval-policy edit was performed.

HUD, gateway and core federation identities remained stable during final checks.
Scheduled DDNS and already-restarting Zoom RTMS services varied independently.
The explicitly approved Node/RAG repair remains active with rollback material;
its private isolated RAG runtime and dispatcher are service dependencies and must
not be deleted as disposable test cache.

All test assistant registrations are disabled. Copilot's original Built-In tool
selection and Default permissions were restored; both owned terminal clients
exited normally. The three final private validation windows closed normally,
including the normal Restricted Mode window; their debug listeners stopped.
The temporary server-env-setup hook was hash-checked and restored to its original
absence. Private exports and screenshots remain local. Two temporary native
connection profiles were removed; the original validation profile remains saved.

The isolated HUD fixtures were stopped. The original fixture launcher required
forced termination after its cleanup helper waited for an already-exited child
following the controlled identity restart. This affected only the test launcher;
no owner process was stopped, and fixture evidence was retained.

### Limitations carried to Mac

- Copilot's permission picker showed Allow all after the first delegated check;
  the cause was not established. It was restored before further calls. A fresh
  Default permissions check completed and required the owner's normal Allow Once
  result review. This is not a claim of uninterrupted default permissions.
- Only the existing OpenClaw installation was live-qualified. No live Hermes,
  WSL reboot, second distribution or Remote SSH qualification is implied. Active
  owner services/work were preserved instead of forcing those platform events.
- Network/Intent inventory was observed without device configuration. No external
  peer work, approval/apply operation or physical mobile capture was submitted.
  Science showed a stale advisory snapshot; mobile showed an unreachable edge;
  OpenShell gateway status was unavailable while sandbox listing returned. Empty
  operation/approval inventories do not establish healthy execution.
- The final source check/build and suite passed: 18 tests, zero failures, one
  optional RAG fixture skipped. Real owner RAG was separately exercised above.
  The new editor regression was exercised through the actual Windows/WSL UI;
  the standalone test:editor runner was not run here and belongs in Mac requalification.
- The original Mac evidence covers the original VSIX. The exact replacement needs
  Mac review/regression/lifecycle checks before Marketplace publication/install
  verification using the existing Mac-local publisher authentication.

The requested pyATS MCP testbed create/upload/edit capability is recorded as a
separate follow-up. No testbed-management backend or other new capability was
implemented in this extension qualification work.

### Audit and milestone documentation

GAIT branch `spec150-qualification-unblock-plan-20261011` records the complete
follow-up; qualification summary `14507b33` and the full 14-entry first-parent
checkpoint log are in [wsl-gait-checkpoint.json](wsl-gait-checkpoint.json). The log
was displayed through `gait_log`; the final push/session-end turn follows locally.
Daily memory was appended in the isolated checkout. A local
[blog draft](../wsl-milestone-blog-draft.md) is ready for review. WordPress and
MemPalace tools were unavailable in this agent session; no external draft/message
or diary write is claimed. No ticket was created.

The installed GAIT server hardcodes its model-provider metadata and default note
to `vscode-copilot`. The Codex-authored qualification records above retain that
server metadata; it is not evidence that Copilot authored those audit turns.
Their recorded user/assistant text identifies the work. No audit history or
backend implementation was rewritten; the final return uses a descriptive note.
