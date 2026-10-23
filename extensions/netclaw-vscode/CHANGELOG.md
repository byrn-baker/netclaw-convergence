# Changelog

## 1.1.0 — workspace files and claw controls

- Add top-panel access to six native workspace Markdown files for OpenClaw and Hermes, with read, reviewed save and exact UTF-8 upload/overwrite; no delete/rename.
- Use the native VS Code document editor for keyboard behavior, Undo and dirty-close protection. Preserve original recovery copies and reject stale revisions.
- Add installation-bound Start/Stop/Restart with durable offline recovery, exact owned-service/supervisor controls and private operation evidence. Unknown ownership disables full control.
- Add Save & Restart gated on verified saved bytes and the reviewed service scope. Keep saving, service readiness and prompt loading distinct.
- Requires source HUD/helper 1.11.0. WSL native-home resolution and systemd neighbor/environment discovery corrections are in the backing source. WSL regular-file reads and native editing/Undo are verified; symlink entries remain refused and live WSL lifecycle is unqualified. See Spec152 release verification.

## 1.0.1 — input and Testbed address hotfix

- Keep Testbed typing local to the webview, without per-keystroke host messages or persisted VS Code state. Bind Save to the reviewed draft revision and reject stale reviews.
- Exclude pyATS `connections.defaults` from endpoint choices, including responses from an already-running HUD. Edit displays the stored endpoint address; shared defaults remain preserved.
- Reject guided endpoint writes to the reserved `defaults` mapping. Advanced YAML continues to support shared settings.
- Add character-by-character editor tests across Testbed, MCP and security forms, endpoint variants, stale review rejection and saved-file readback. Windows VS Code 1.141.0 with a WSL extension host passed ten focused input workflows and all 18 experience checks / 149 layout cases. The reported one-character failure was traced to still-loaded 0.1.1 code despite 1.0.0 being installed; reload the window after installing the update.

## 1.0.0 — button hotfix

- Bring Testbed Edit/Add forms and YAML/review panels into view, then focus an enabled field. Existing-device edits no longer appear to do nothing beneath a long device list.
- Keep keyboard focus while typing, retain the selected connection in saved drafts, prevent overlapping actions, and explain when no recovery copies exist.
- Reveal security reviews, invalidate the old visible review when editing a different rule, and keep MCP Reload available after metadata errors.
- Serialize Chat and Canvas actions, recover Canvas Send after a failed admission or interrupted request, and prevent delayed responses from enabling disconnected views.
- Add existing-device edit/save/cancel/preservation and button-recovery regression coverage. No HUD upgrade is required for this hotfix beyond the existing full-editor prerequisites.

## 0.1.1 — release candidate

- Restore testbed details and MCP configuration access with older running HUDs. Safe editing uses the updated HUD; legacy environment changes retain native review.
- Show native security ACLs, tool scopes, filesystem/process permissions and redacted YAML. Support actual DefenseClaw 0.8.4 connector commands and OpenShell 0.0.32 YAML policy commands.
- Preserve policy fields, refuse stale or unknown outcomes, and qualify native changes against isolated real targets.
- Include the topology renderer and its license notice in the VSIX; packaging now checks every emitted runtime asset.


## 0.1.0 — release candidate

Initial extension client for existing NetClaw: host-bound profiles, HUD observations,
Chat/Canvas/local Avatar, integrated RAG, reviewed environment/budget settings,
existing Intent/peer chat, prepared service commands and opt-in assistant MCP.
Uses unchanged NetClaw interfaces. Publication is on hold by the owner.

WSL qualification fix: restore Chat, Canvas, RAG and observation views after
switching tabs by retaining their message sequence across webview reloads.
Installation binding and replay checks remain enforced.

Windows local hosts now show explicit WSL guidance and filter the command palette
to WSL commands before any connection can be added.

Mac qualification fix: RAG controls show an operation in progress and prevent
overlapping submissions while collections refresh, retrieval runs or native
review is open. Controls recover on completion/cancellation/error and remain
disabled after disconnection. No operation is automatically replayed.
