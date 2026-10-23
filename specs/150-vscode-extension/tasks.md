# Spec150 recovery tasks

This list supersedes the expanded branch's 79 tasks. No old checkmark transfers.
Paths below are relative to the repository. All stories remain in scope.

Current owner instruction (2026-10-11): complete implementation/functionality and
Mac qualification, then stop before publication. Implementation completion is
T001–T022. T023 is a separately held release action, never a completed task.
Advanced enhancements/aesthetics are future Spec151 scope.

## Foundation
- [x] T001 Record source audit and preserved branches in specs/150-vscode-extension/scope-recovery.md.
- [x] T002 Correct spec, plan, research and contracts in specs/150-vscode-extension/.
- [x] T003 Reuse extension assets and isolate package/build inputs in extensions/netclaw-vscode/.
- [x] T004 Implement and test bounded existing-HUD client in extensions/netclaw-vscode/src/client/.

## US1: connect and inspect
- [x] T005 [US1] Implement host-local profiles, trust and identity binding in extensions/netclaw-vscode/src/state/ and src/connection/.
- [x] T006 [US1] Map domain inventory and native navigation in extensions/netclaw-vscode/src/views/ and src/extension.ts.
- [x] T007 [US1] Verify existing HUD connection and identity changes in extensions/netclaw-vscode/test/.

## US2: conversation and knowledge
- [x] T008 [US2] Implement owned chat, model selection and uncertain-outcome behavior in extensions/netclaw-vscode/src/client/ and src/views/chat.ts.
- [x] T009 [US2] Reuse Canvas/Avatar and selected-context UX in extensions/netclaw-vscode/src/views/ and webview/.
- [x] T010 [US2] Implement integrated RAG search, citations and reviewed upload in extensions/netclaw-vscode/src/views/rag.ts.
- [x] T011 [US2] Verify chat/session/context/RAG boundaries in extensions/netclaw-vscode/test/.

## US3: management
- [x] T012 [US3] Implement supported configuration review and actual result reporting in extensions/netclaw-vscode/src/views/settings.ts.
- [x] T013 [US3] Integrate existing federation, audit, security and other HUD domains; record specific gaps in specs/150-vscode-extension/evidence/capabilities.md.
- [x] T014 [US3] Verify no new backend runtime/configuration dependencies in extensions/netclaw-vscode/test/.

## US4: assistants
- [x] T015 [US4] Implement official-SDK bounded stdio adapter in extensions/netclaw-vscode/src/assistants/.
- [x] T016 [US4] Implement explicit Copilot discovery and terminal setup in extensions/netclaw-vscode/src/assistants/.
- [x] T017 [US4] Test inspection, delegation, proposal and denied approval/apply tools in extensions/netclaw-vscode/test/.
- [x] T018 [US4] Record named-client Mac checks in specs/150-vscode-extension/evidence/assistants.md.

## US5: qualification and release
- [x] T019 [US5] Review the WSL replacement, fix the reproduced RAG overlap defect and qualify the exact final VSIX on Mac; preserve original evidence and record final results in evidence/mac-final.md.
- [x] T020 [US5] Finalize extension README/privacy/package documentation in extensions/netclaw-vscode/.
- [x] T021 [US5] Package committed source, push and provide final specs/150-vscode-extension/windows-wsl-handoff.md.
- [x] T022 [US5] Receive real Windows/WSL results and resolve confirmed extension defects; preserve evidence/wsl.md and evidence/wsl-followup.md, and qualify the exact final Mac artifact's RAG delta in evidence/wsl-final.md.
- [ ] T023 [US5] **HELD BY OWNER — DO NOT PUBLISH:** publish qualified VSIX and verify Marketplace installation only after new explicit authorization; record in specs/150-vscode-extension/evidence/publication.md.

Dependencies: foundation -> US1 -> US2/US3 -> US4 -> US5. Domain mapping and
read-only research can run independently; implementation changes are sequential.
Each story has the independent acceptance test specified in spec.md. Stop backend
scope expansion at a demonstrated gap and report it; do not silently add a service.

T018 records actual results and limitations; it does not assert full named-client
acceptance across all platforms. Actual signed-in interactive Copilot, Claude Code
and Codex Windows/WSL checks, including the Copilot permission deviation and fresh
default-mode follow-up, are recorded in evidence/wsl-followup.md.

Final WSL return, 2026-10-11: T022 is complete for the existing OpenClaw
Windows/WSL scope documented in evidence/wsl-followup.md and its structured report.
The owner-approved HUD Node and isolated RAG prerequisites were repaired; the
Windows update finished normally. Two reproduced extension defects were fixed:
webview message sequence reset after tab changes, and Windows-local WSL guidance.
The exact final VSIX is artifacts/netclaw-0.1.0-wsl-fixes.vsix, SHA-256
`f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`.
Live workflows, host/trust boundaries, fixture-only settings/fault cases and actual
installed lifecycle are recorded with their limits. The original and intermediate
VSIX/evidence remain preserved. No owner device configuration or external peer work
was submitted, and no WSL reboot/second-host or live Hermes acceptance is implied.

Final Mac work: T019 is complete, including an additional RAG busy-state fix.
Implementation tasks T001–T022 are complete for the documented scope. T022 above
qualifies its recorded WSL artifact. The later targeted Windows/WSL run now
qualifies the final Mac RAG delta on the unchanged `b13bdfe6…` artifact; see
evidence/wsl-final.md and evidence/wsl-final-checks.json. No further Mac handoff is
required for this validation. See closure.md and evidence/mac-final.md for the
final source/digest and exact acceptance limits.

T023 is explicitly held by the owner. The later 2026-10-11 instruction authorizes
PR/merge and branch cleanup onto main, with the final targeted WSL check described
in final-wsl-prompt.md. Publication authorization remains revoked; new explicit
authorization is required before publication. Do not turn this pending release
action into an implementation checkmark.
