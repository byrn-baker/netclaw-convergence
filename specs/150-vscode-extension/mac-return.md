# Mac return — completed implementation; publication held

**Superseded handoff:** source consolidation onto main is now authorized. Use
[final-wsl-prompt.md](final-wsl-prompt.md) for the remaining WSL delta. Instructions
below are historical, including the former merge hold and old branch names.
Publication remains prohibited.

This return was processed on `150-vscode-extension-mac-final-20261011`.
See [closure.md](closure.md) and [final Mac evidence](evidence/mac-final.md) for the
new RAG correction, exact final artifact, completed implementation and remaining
future-release confirmation. The older handoff below is retained as history;
do not rerun it or substitute its preceding artifact for the final build.

**Owner override, 2026-10-11: DO NOT PUBLISH.** Finish Spec150 implementation,
features, functionality and replacement Mac qualification. Publication is on hold
until a new explicit owner instruction. Advanced extension enhancements and
aesthetics belong to a future Spec151. This override supersedes the older release
authorization in historical handoffs and evidence; do not run publishing commands.

Return branch: `150-vscode-extension-wsl-followup-20261011`.
Evidence commit: `f2661e22f76a436c3dfca1b86fc9fac1c7e98af7`.
The following commit updates only this return document. Its exact branch-tip
commit is supplied in the handoff message. No merge or publication occurred on WSL.

Final candidate: `NetClaw.netclaw@0.1.0`.

```text
specs/150-vscode-extension/artifacts/netclaw-0.1.0-wsl-fixes.vsix
SHA256 f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45
2349236 bytes
Source 7b4ebee3cf819aeab86622606eb9afc729a7748b
```

Use this exact committed VSIX. The original `netclaw-0.1.0.vsix` and intermediate
`netclaw-0.1.0-wsl-webview-fix.vsix` are preserved for history and comparison.
Two actual extension defects were fixed: hidden webviews lost their message
sequence and stopped accepting requests; Windows-local Add Connection ignored
its WSL command filter. Replay/identity/trust and approval checks were retained.

The [final WSL matrix](evidence/wsl-followup.md) and
[structured report](evidence/wsl-followup-checks.json) record the results:

- Real Windows VS Code 1.141.0 with WSL extension/storage isolation; live binding,
  reconnect, 22 observation panels, provider Chat, selected editor/RAG context,
  ready indexed upload/citation, Canvas and local Avatar checks.
- Actual interactive Copilot, Claude Code and Codex inspection, inert drafts,
  harmless delegated answers/status and disabled-registration refusals. Their
  adapter payload is byte-identical in the original and final VSIX. Copilot's
  observed Allow all deviation, restoration and fresh Default permissions check
  with human Allow Once result consent remain explicit limitations for review.
- Native settings Apply and preservation against an isolated unchanged HUD
  fixture; real-owner reviews cancelled. Pending-disconnect and identity mismatch
  were tested using that isolated fixture. Actual Restricted Mode and Windows-local
  host boundaries passed. No owner configuration or external peer work was sent.
- Installed synthetic older-version upgrade, native disable/re-enable/uninstall,
  exact reinstall and reconnect passed. All 20 extension state files survived
  uninstall byte-for-byte; owner extension payload still matches the original VSIX.
- Source check/build and 18 tests passed, with one optional RAG fixture skipped.
  Real owner RAG was exercised separately. Actual Windows/WSL UI covered the new
  tab-switch regression; the standalone test:editor runner remains for Mac.

The explicitly authorized HUD Node and isolated RAG repairs succeeded. Preserve
those running repairs and their rollback backups. The isolated RAG runtime and
its dispatcher are active HUD service dependencies, not disposable test cache.
Owner source/testbed edits, observed credential files, native identity and core
services were preserved. Across the whole interactive phase, `.claude.json` changed
with signed-in CLI use and approved private-folder trust; exact old field diff is
unavailable. All 12 protected observations stayed unchanged across final management
and lifecycle checks. Global Codex configuration stayed unchanged.

Assistant registrations were disabled, Copilot's original tool selection and
Default permissions restored, owned clients/windows closed, and the temporary
editor hook restored to its original absence. Raw evidence remains private on
WSL. The harmless RAG fixture `spec150-wsl-rag-20261011-b7a3d92e.md` is retained as
`doc_0e84d3b40932`, one ready chunk; no corpus deletion/reindex occurred.

**T022 is complete for the documented existing OpenClaw Windows/WSL scope.
T019 is reopened for the exact replacement on Mac. T023 remains open.**
No live Hermes, WSL restart, second distro/SSH, device changes, external peer work
or physical mobile qualification is implied. Optional source observations include
stale Science, unreachable mobile and unavailable OpenShell gateway status.
The [milestone blog draft](wsl-milestone-blog-draft.md) is local and unpublished.
The pyATS MCP testbed-management request is a separate follow-up, not part of this
extension change.

## Prompt for Mac

```text
Continue NetClaw Spec150 from origin/150-vscode-extension-wsl-followup-20261011.
Fetch the branch, pin the exact returned tip supplied in the handoff message, and
require f2661e22f76a436c3dfca1b86fc9fac1c7e98af7 as an ancestor.
Preserve existing work/services and use an isolated checkout. Read AGENTS.md,
startup files, daily memory, constitution, Spec150 spec/plan/tasks/scope-recovery,
contracts/existing-interfaces.md, mac-return.md, evidence/wsl-followup.md,
evidence/wsl-followup-checks.json and the retained Mac/assistant evidence.
Follow GAIT branch AND checkout, recording, daily-memory and session-end log rules.

Final exact NetClaw.netclaw@0.1.0 artifact:
specs/150-vscode-extension/artifacts/netclaw-0.1.0-wsl-fixes.vsix
SHA256 f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45
Packaged from source 7b4ebee3cf819aeab86622606eb9afc729a7748b.
Do not substitute the original or intermediate VSIX, or rebuild merely to resume.

WSL qualification is complete for the recorded existing OpenClaw scope (T022).
Review its limitations, especially the Copilot permission deviation and fresh
Default permissions/Allow Once check. The two extension fixes require exact
replacement Mac qualification (T019): install the committed artifact in an
isolated Mac profile; exercise hidden/revealed Chat, Canvas, RAG and observation
views, actual provider/context workflows and installed lifecycle. Run the updated
editor regression and appropriate source checks using isolated dependencies.
Original Mac results do not by themselves qualify the replacement. Address any
remaining client/platform gate identified by review with actual evidence and
normal human consent; do not weaken permissions or infer untested acceptance.

WSL's approved HUD Node/RAG repairs, backups and owner installation are preserved;
no further backend repair or upgrade is required by this return. Keep extension
fixes confined to reproduced defects. No testbed-management/backend expansion.
If package inputs change again, preserve this VSIX and qualify the exact new one
on the required hosts before release.

After review and Mac qualification pass, record implementation completion and
the exact qualified artifact in mac.md/tasks.md and closure.md. DO NOT PUBLISH.
T023 is explicitly held by the owner, not a completed release. Do not use publisher
credentials or merge to main. Keep the milestone blog draft for John's review.
Advanced enhancements and aesthetics belong to a future Spec151; do not expand
this implementation. Push the completed work and report the actual scope honestly.
```
