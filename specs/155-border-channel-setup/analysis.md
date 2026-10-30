# SDD analysis — Complete Comms Setup

Date: 2026-10-25. Analyzed spec, plan, data model, contracts, research and 50-task ledger against the project constitution. Analysis was read-only; the following design remediation was then applied under the owner's existing instruction to drive SDD implementation.

| Finding | Severity | Resolution |
| --- | --- | --- |
| New effect and placement fields were described but not exact enough for engine/frontend agreement. | High | Data model now defines `comms`, `comms-binding`, exact effect IDs, `commsBindings`, capacities and legacy outbound default. T007–T009/T018/T041 verify enforcement. |
| Hermes Home Assistant shares ingress and device tools, conflicting with ordinary Border channel placement. | High | Explicit Focused-only installer disposition with pinned source evidence. Catalog/role tests must retain it. No shared-policy exception. |
| Pinned-index omissions could incorrectly label ClickClack/WeCom unavailable. | High | Inventory separates current docs from source-confirmed pin support and canonical/native IDs. Four genuinely absent OpenClaw options remain version-gated. |
| Native helper packaging and Zoom process lifetime could be replaced with nominal CLI/discovery success. | High | T017 and T035 remain explicit packaged-helper and actual lifetime gates; no guessed distribution imports or separate in-memory registries. |
| Verification document still described specification-only work. | Medium | Baseline updated to planning/implementation status and actual credential results, with provider evidence separate from installer acceptance. |

All 32 functional requirements and nine success criteria map to tasks in the ledger's coverage table. Six user stories have implementation and verification coverage. No orphan requirement, unbounded command contract, mandatory constitution exception or unresolved design ambiguity was found after remediation. The 26-item specification quality checklist is complete. Optional commit hooks are not implementation prerequisites.

This is design consistency, not acceptance. Every supported adapter still requires its stated implementation and installer evidence. The owner's qualification scope covers isolated setup, ownership, dependency acquisition, native discovery, access refusal and recovery; it excludes operational capability retesting. Missing provider accounts and unperformed live authentication, pairing, transport or delivery remain explicit readiness limits, rather than requirements to perform those operations during installer acceptance. Required Mac/editor and WSL installer checks remain open until their own evidence exists. A documentation card or simulated provider cannot establish live readiness.


## Final source handoff review

T019's phrase “all compatible inventory entries” was broader than FR005/FR007. It now names compatible selectable channels and NetClaw component paths. The eight related-interface entries retain their honest incomplete-adapter dispositions as contextual references; no new telephony, A2A, relay or meeting API implementation is claimed. T029 explicitly leaves unsafe/unimplemented inbound and public callback reachability checks unverified.

Review found missing Hermes startup disclosures and Home Assistant's connection/state subscription/device-tool registration disclosure. All 22 Hermes metadata rows were reconciled against pinned adapter startup paths, and every selectable channel now has nonempty startup disclosures. A catalog-to-review regression preserves these effects plus capability kind and setup explanation; T024 is closed. Known empty-access pre-activation refusal is now configuration-required instead of unknown; unexpected errors and uncertain process outcomes retain unknown. Earlier Mac frozen-run hashes, subsequent focused checks and the partial WSL return remain distinct.

## Mac reconciliation cross-artifact review — 2026-10-25

Reviewed the constitution, specification, plan, tasks, data model, setup contracts, Mac/WSL handoffs, verification and all-entry coverage against the source at WSL return `04645395530a060b35404ec3a27bc516ae9ba076`. The task table maps all 32 functional requirements and nine success criteria to the 50 tasks; this is traceability coverage, not an acceptance percentage. No new constitution conflict, uncovered requirement or production source blocker was found in this review.

| Finding | Severity | Disposition |
| --- | --- | --- |
| Earlier analysis treated missing provider accounts and Twilio authorization as required installer gates. | Medium | Corrected above. Fixture-based setup qualification keeps live authentication, transport and delivery unverified without performing prohibited operations. |
| OpenClaw Twilio voice coverage used the same native-discovery label as core Twilio and Zoom. | Medium | The precise evidence is locked voice dependency acquisition and controlled routing/ownership contracts in `tests/test_setup_comms_voice.py`. `tests/test_setup_comms_native.py` probes core Twilio and Zoom only; the coverage ledger must retain that distinction. |
| Earlier handoff wording described WSL execution as future work. | Low | WSL has partially executed. Its six service-manager failures, skipped fixtures and absent genuine remote-editor acceptance remain recorded in the WSL evidence. |

Source checks confirmed plan/effect and manifest review binding, declared startup/access effects, verified owned configuration before activation, exact service/PID-generation observation, interrupted-effect ownership checks, unknown pairing outcomes without replay, and structural report projection with separate readiness dimensions. This review is separate from the actual Mac runtime/editor evidence and does not claim that every provider is ready.

Mac installer acceptance is complete within the documented local fixture boundaries. The [runtime evidence](evidence/mac-runtime-results.json) records both actual empty-home engines, each with eleven verified effects, retained Slack/Discord settings, explicit pause/resume, ownership refusal and an empty-access stop before service artifacts. Their private wrapper errors are retained separately from the successful read-only postchecks; no journal was rewritten or replayed to repair the wrapper. Four fresh component installations and four native core-Twilio/Zoom registry combinations passed. Positive service checks used real owned files and inert child processes with controlled native inspector and manager responses; they do not establish actual provider transport or native launchd execution.

The [editor evidence](evidence/mac-editor-results.json) records four final OpenClaw/Hermes × Focused/Risk scenarios in actual isolated VS Code 1.109. Channel selection/removal, cancelled setting edits, native setting prompts, ownership restrictions, panel/window reload, keyboard operation, themes and zoom passed. Both actual engine-generated redacted reports were opened as local documents; this result is distinct from invoking the product report button or export dialog. The source-development extension host was tested; packaged VSIX installation was not claimed.

The full Mac Python run passed 261 of 268 tests with seven skips; four opted-in methods subsequently passed in separate runs without changing the full-run counts. Extension checks/build passed, and its suite passed 143 of 146 tests with three explicit skips. Catalog checks account for 77 Comms entries and zero unexplained catalog gaps. [Preservation evidence](evidence/mac-preservation.json) records 8,012 primary and 469 supplemental files, eleven selected logical tables, twenty existing process identities and one additionally selected live-service identity unchanged. Its later supplemental baselines, selected-root limits and one new process at the final snapshot remain explicit. The original checkout branch, HEAD and clean status were preserved.

The WSL final Python result is 261 passed and seven skipped; the final extension result is 137 passed, six failed and three skipped. The failures remain failures. Actual WSL remote VS Code and isolated-manager acceptance are open; Mac results cannot close them. Preservation claims retain the scope and named-identity limits in `evidence/wsl-preservation.json`.

The reconciled evidence satisfies T047's Mac installer acceptance scope. The final source/cross-artifact review and milestone draft portions of T050 are complete; its session closure requires the parent workstream's GAIT record. T048 remains open. Keep overall `complete: false` while required WSL gates remain open. No merge, release, publication or deployment into an existing installation is authorized by this reconciliation.
