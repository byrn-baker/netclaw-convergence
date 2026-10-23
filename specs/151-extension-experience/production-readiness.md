# Production readiness — VS Code 0.1.1

Date: 2026-10-11. Branch: `prod-ready`. This is an unpublished candidate. The owner requested a deep release audit, compatibility fixes and real native security integration qualification. This supersedes the original Spec151 source-only checkpoint for the checks explicitly recorded here.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| A running HUD predating the new document/configuration routes returned 404 and prevented all testbed/MCP access | Only a missing route permits compatibility reads. Device details and field presence remain visible. Legacy environment replacement opens the existing native review, scoped to the chosen integration. Full document/configuration editing still requires the updated HUD process. Authentication, identity, conflict and server errors never downgrade to a compatibility path. |
| Installed OpenShell 0.0.32 rejects `--workspace`, JSON policy output and `--base` | Probe supported flags; use explicit gateway/default workspace/sandbox, parse the native YAML response and inspect gateway-global policy. Unknown/global scope stays read-only. Save with native `policy set --wait`, verify the exact policy and active revision, preserve non-network fields. Empty network maps omitted by native serialization are normalized. |
| Installed DefenseClaw 0.8.4 lacks the assumed config get/set writer; tool rules reside in SQLite | Use native tool list/allow/block/unblock and readback for one configured connector. Preserve global/source rows. Global mutation is withheld because that CLI clears other connector overrides. Enforcement defaults remain visible but read-only on this version. |
| Security pages lacked visible YAML and permission details | Add redacted policy YAML, configuration location, filesystem/process/asset permissions, actual tool scopes, and policy/active revision. Suggest the identity-matching local runtime home and discover native OpenShell sandboxes. |
| Structured `api_key` values could escape the security redactor | Mask API-key fields in displayed configuration and protected network drafts. Tests cover hidden values and inert rendering. |
| Production DefenseClaw audit DB exceeded the proposed read bound | Validate DB file type/path without reading the audit database into memory; all rule access uses native CLI. |
| The packaged topology renderer was omitted | Include topology bundle/notices and verify all generated runtime bundles are included when packaging. |
| Dependency license texts were not all captured by esbuild's comment extraction | Collect notices from every bundled package using esbuild metadata and ship `THIRD-PARTY-NOTICES.txt`. Missing license text fails the build. |
| Extension lacked a dedicated CI release gate | Add read-only CI for clean installs, typecheck/build, extension and HUD contract tests, dependency audit, package validation and candidate artifact upload. It does not publish. |
| Native editor acceptance could load development source alongside a candidate and reported a hard-coded Mac scope | Exact-artifact runs now load only the installed extension, compare every payload file, and report the actual platform. |

## Executed qualification

Host: Ubuntu 22.04 under Windows WSL2. Supported build Node: 24.19.0. Existing active user HUD and device/security configuration were preserved; security mutations used isolated targets.

- Extension typecheck/build: passed.
- Extension suite: **57 passed, zero skipped**, including real source-HUD integration, actual local cached RAG ingestion/retrieval, assistant MCP transport, ownership/identity, testbed/configuration round trips, preservation, cancellation, stale revisions, native CLI formats and webview invalidation.
- HUD unit suite: **372 passed**. Testbed/MCP document/configuration suite: **9 passed**. HUD production build passed; existing large-chunk warnings remain informational.
- Extension and HUD npm audits: zero known vulnerabilities at qualification time.
- Minimum supported VS Code **1.102.0** desktop activation and core interaction suite: passed on the Linux extension host under WSL. Includes actual Electron MCP launch, theme rendering, chat through the isolated HUD, Canvas, Avatar and invalidation.
- Native desktop experience suite: **14 checks, 149 layout cases, 42 screenshots**. All generic views, testbed create/preview/review/save, draft/theme preservation, MCP secret replacement/reset, security binding/cancellation/acknowledgment/readback, BGP/WebGL fallback, search, keyboard, narrow widths and 200% zoom passed against isolated fixtures. The original report's hard-coded Mac label was incorrect; the runner now records platform explicitly.
- All **22** domain inspections returned successfully from the actual running NetClaw. Compatible inventory returned **5 devices** and **88 integrations**. HTTP success does not certify every optional service or tool's operation.
- Actual configured OpenClaw provider: one extension-owned no-tool smoke conversation completed with the expected response. No automatic retry occurred.
- Existing real DefenseClaw **0.8.4** and OpenShell **0.0.32** profiles inspected through the new adapter; permissions and redacted YAML available. Existing OpenShell sandbox exposed **29 network rules**.
- Separate DefenseClaw profile: native **allow → block → remove** operations verified through `tool status` with effective states `allow`, `block`, `none`; configuration bytes unchanged. The first run found an actual `block` versus assumed `blocked` status mismatch, retained an unknown outcome without retry, and was explicitly reconciled after native inspection before continuing with the corrected parser.
- Separate Docker-backed OpenShell sandbox: network update and active revision readback passed; real curl request **denied → allowed → denied** when adding and restoring a reviewed explicit rule. Filesystem/process policy was preserved. The initial hostname probe exposed DNS failure inside the sandbox; the successful probe used public IP `1.1.1.1`. This does not certify DNS or every destination/protocol. The test sandbox used native `--no-keep` lifecycle; the existing `netclaw` sandbox was untouched.
- Live testbed SHA256 remained `0765b65271a064ca3077a1ae9db52d2c46791b5512da6f8c8c51eaee910d466c`, matching the pre-change baseline.

Private machine evidence lives in `~/.cache/netclaw-prod-ready-20261011/`; raw native configuration, logs, recovery snapshots and live screenshots are deliberately not committed.

## Exact artifact and installed acceptance

Source commit: `2afa5b1b7a953f4822bbb9a15e45ff06ff6facf5`. Artifact: `extensions/netclaw-vscode/netclaw-0.1.1.vsix`, 4,211,457 bytes. SHA256: `0a7c43238f3df39f409054d8ccb76975aa847d5986ffbcb2a2c645574da75d57`.

- VSCE packaging and generated-asset validation passed. All 32 extension payload files were inspected; topology, all runtime bundles and third-party notices are present. Private state, testbeds, credentials, source/test code and development dependencies are excluded.
- Installed VSIX experience acceptance on VS Code 1.102.0 passed: **14 checks, 149 layout cases, 42 screenshots**, including actual reviewed fixture writes and native cancellation. Every installed payload file was compared with the VSIX; the product was not loaded from a development path.
- Separate installed VSIX acceptance against the actual running older HUD passed: five device cards; unsupported testbed writes disabled; scoped integration field presence; native environment review opened and cancelled without a write. Both actual DefenseClaw/OpenShell targets were bound through native dialogs, with visible permissions and redacted YAML. No real security-policy mutation occurred during these UI checks.
- The same VSIX is installed in the owner's original temporary WSL editor profile; all 32 payload files match. Version 0.1.1 becomes active when that editor is reloaded. No reload was forced. Existing normal editor extension registries and the user's main checkout were not changed.
- The isolated OpenShell create command stalled in its provisioning event stream even though native inspection showed the sandbox Ready and policy/traffic tests succeeded. Its requested `--no-keep` cleanup therefore did not run. The owned CLI was interrupted after qualification; `netclaw-prod-ready-check` remains available for inspection with its empty network-policy baseline restored. It has no attached model providers or copied host credentials. The preexisting `netclaw` sandbox remains at policy revision 2 with 29 network rules. No destructive cleanup command was issued.

These results qualify the artifact above. Subsequent evidence-only commits do not change its application payload. The Linux desktop test runs under WSL/Xvfb; this is distinct from re-running all UI checks through the Windows Remote WSL transport.

## WSL handoff release gates and limits

These were the outstanding gates at the WSL handoff. The Mac follow-up below records their subsequent disposition.

1. The currently running user HUD was started before the new safe editing routes existed. The compatibility UI restores reads and native environment review. Full testbed/scoped MCP editing requires a controlled HUD restart/update; the extension cannot add server routes to an already-running process. No restart was imposed while the owner was testing.
2. Marketplace publishing credentials and publisher access have not been verified in this session; no configured VSCE PAT, Azure identity or VSCE store was found. Authenticate as an authorized member of publisher `NetClaw` before publication. No credentials belong in the repository or report.
3. Push the reviewed source before publication so commit-pinned Marketplace README links resolve, and complete the owner's publication approval. No push or Marketplace publication is part of this qualification checkpoint.
4. This patch's real native CLI and desktop acceptance was on the Linux host under WSL. Native Mac, Remote SSH and complete Windows Remote WSL UI requalification for this exact artifact remain separate; original Mac Spec151 fixture evidence is not new native-provider evidence. The temporary Windows Remote WSL installation is updated and byte-verified, awaiting the owner's reload. Native Windows runtime hosting and browser VS Code remain unsupported as documented.
5. Native OpenShell and legacy DefenseClaw CLI writes lack an atomic compare-and-swap interface. Immediate rechecks, native scope, readback and private evidence protect against common mistakes; another editor or external writer can still race. Unknown outcomes block replay. Runtime traffic, connector hook enforcement and stored policy are separate states.

The test results establish the stated coverage; they are not a claim that all possible deployments are defect-free.

## Final Mac acceptance — 2026-10-11

The original WSL-tested VSIX was retrieved from the draft release handoff and matched SHA256 `0a7c43238f3df39f409054d8ccb76975aa847d5986ffbcb2a2c645574da75d57` exactly. No repackaging or application changes were needed. The separately generated CI artifact differs only in its README's commit-pinned links; it is not the artifact qualified here.

- Native macOS arm64, VS Code **1.108.0**: the original installed VSIX passed **14 experience checks, 149 layout cases and 42 screenshots**. All 32 installed payload files matched the original package (ignoring VS Code's added package metadata). The product loaded from the isolated installed extension directory; the development extension was only the test observer.
- Connection prompts, Testbed creation/review/save, MCP secret replacement and reset, both security menus, native cancellation, weakening acknowledgment, security fixture writes/readback, topology fallback, theme changes, narrow layouts, keyboard navigation and 200% zoom passed. Security writes used isolated CLI fixtures.
- The same original VSIX was installed in a persistent throwaway Mac editor and connected to the owner's actual installation through the updated HUD. Full Testbed and MCP editing routes were available, existing secret values stayed hidden, and both security menus displayed posture and suggested the identity-matching runtime home. Native target-binding dialogs were cancelled. Configuration/testbed hashes matched the baseline; no device, production configuration or security policy was changed.
- Mac automated verification: extension typecheck/build and **56 tests passed**, with the optional cached-embedding RAG case skipped; HUD **372 unit tests and 9 document/configuration tests passed**, and its production build passed. The first extension test invocation preceded its required bundle build; the affected MCP transport test passed after building. The WSL record above retains its separate 57/57 extension result.
- `prod-ready` and the packaged source commit are now on GitHub. Every commit-pinned README documentation link returned HTTP 200. Microsoft `vsce verify-pat NetClaw` verified the stored publisher credential without displaying or changing it.
- Native DefenseClaw/OpenShell executables are not installed on this Mac. This acceptance establishes installed macOS UI and adapter-fixture behavior; actual vendor CLI operations and OpenShell traffic enforcement remain qualified on WSL as recorded above.

Machine-readable scope and results: [mac-acceptance.json](mac-acceptance.json). Raw screenshots and machine evidence remain private in the Mac owner's cache.

### Marketplace submission

After the owner's conditional publication authorization and the Mac acceptance above, `vsce publish --packagePath` submitted the **unchanged original VSIX** from this Mac on 2026-10-11. Microsoft returned `Published NetClaw.netclaw v0.1.1`. No new package, version bump or application-source change was made. The listing is [NetClaw on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=NetClaw.netclaw); Marketplace processing and listing visibility are separate from successful submission. The GitHub artifact handoff remains a draft release.

Follow-up verification found version **0.1.1** with a public visibility flag in Microsoft's gallery API and downloaded its VSIX from the gallery CDN. Its complete archive matched the original SHA256 **`0a7c43238f3df39f409054d8ccb76975aa847d5986ffbcb2a2c645574da75d57`**, byte for byte; all 32 extension payload files matched as well.

## Primary references

- [VS Code publishing requirements](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [OpenShell v0.0.32 native policy implementation](https://github.com/NVIDIA/OpenShell/blob/v0.0.32/crates/openshell-server/src/grpc/policy.rs)
- [OpenShell v0.0.32 CLI](https://github.com/NVIDIA/OpenShell/blob/v0.0.32/crates/openshell-cli/src/run.rs)
- [DefenseClaw upstream](https://github.com/cisco-ai-defense/defenseclaw), with installed 0.8.4 `commands/cmd_tool.py` and `enforce/policy.py` used to verify connector/global/source semantics.


### Public-page availability correction

At 2026-10-11T23:16:25Z the public item page still returned **HTTP404**. The authenticated publisher API confirms installation target **Microsoft.VisualStudio.Code**, but version0.1.1 has not been marked validated; a validated-only gallery query excludes it. No validation failure message was returned. Upload success, the gallery public flag and a downloadable archive must not be reported as proof that the public listing is working. The exact-artifact acceptance and CDN hash verification above remain valid. README promotion and the requested website feature article are held until the item page works.


At **2026-10-11T23:20:32Z**, validation completed: the item page returned **HTTP200**, displayed the **Visual Studio Code** category and `vscode:extension/NetClaw.netclaw` Install link, and the validated-only gallery returned version **0.1.1**. The public-link gate is now satisfied.
