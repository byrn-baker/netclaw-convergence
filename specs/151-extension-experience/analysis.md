# Cross-artifact analysis

2026-10-11. Read-only analysis covered spec, plan, tasks, contracts and constitution. The owner explicitly authorized remediation of all findings before implementation. Edits occurred after the read-only report, followed by a second read-only pass.

| ID | Severity | Initial finding | Resolution |
|---|---|---|---|
| I1 | High | CSV export multi-connection rows conflicted with unique device-ID import rule | Composite (id,connection) uniqueness and repeated metadata consistency; contract/research/T011 aligned |
| I2 | High | Masked YAML could exceed existing bridge cap |256KiB source,512KiB projection,1MiB testbed-only bridge; explicit oversize refusal; plan/contract/T003 aligned |
| C1 | High | Coordinator precheck could miss edits before helper write | Expected config/sidecar revisions checked in canonical registration helper; T023/contract updated |
| C2 | Medium | Export modes and post-revocation write-fault checks implicit | mode0600 export and backup/write fault tests explicit in T011 and contract |

Second pass: **0 unresolved findings; 0 constitution conflicts; 0 ambiguous requirements; 0 duplicates; 0 unmapped tasks.** 35/35 requirements covered by32 tasks. All task syntax valid; all14 requirements-checklist items complete. This is design consistency evidence, not implementation completion.

| Requirement | Covered | Tasks |
|---|---|---|
| FR-001 | Yes | T003, T007, T008 |
| FR-002 | Yes | T006, T007 |
| FR-003 | Yes | T005, T006 |
| FR-004 | Yes | T006 |
| FR-005 | Yes | T009, T010 |
| FR-006 | Yes | T007, T008, T016 |
| FR-007 | Yes | T007 |
| FR-008 | Yes | T007, T028 |
| FR-009 | Yes | T007, T027 |
| FR-010 | Yes | T006, T009 |
| FR-011 | Yes | T011, T012, T015, T016 |
| FR-012 | Yes | T011, T013, T014, T015, T017 |
| FR-013 | Yes | T011, T012, T013, T015 |
| FR-014 | Yes | T011, T012, T013, T016 |
| FR-015 | Yes | T014, T017 |
| FR-016 | Yes | T018, T019, T020 |
| FR-017 | Yes | T018, T019, T020 |
| FR-018 | Yes | T018, T019, T020 |
| FR-019 | Yes | T018, T019, T020 |
| FR-020 | Yes | T021, T022, T023 |
| FR-021 | Yes | T026, T027, T028 |
| FR-022 | Yes | T025, T028 |
| FR-023 | Yes | T008, T029, T031 |
| FR-024 | Yes | T003, T004, T010, T014, T015, T017, T021, T022 |
| FR-025 | Yes | T002, T032 |
| FR-026 | Yes | T001, T032 |
| FR-027 | Yes | T021, T022, T023, T024 |
| SC-001 | Yes | T005, T030 |
| SC-002 | Yes | T009, T010 |
| SC-003 | Yes | T011, T017 |
| SC-004 | Yes | T024 |
| SC-005 | Yes | T030 |
| SC-006 | Yes | T005, T030 |
| SC-007 | Yes | T029, T032 |
| SC-008 | Yes | T001, T031, T032 |

Original design checkpoint: implementation and post-change analysis followed; see the final pass below. Optional Git commit hooks are disabled by repository auto-commit configuration; no publication hook is run.

## Implementation review findings and fixes

| ID | Finding | Resolution / evidence |
|---|---|---|
| R1 | Scoped helper rejected legacy intentionally empty protected-bridge selection | Restored backward-compatible empty output; coordinator alone refuses empty direct operations;39 installer regressions pass |
| R2 | GAIT canonical registration could use default home instead of selected home | Bind GAIT_VENV to selected runtime; refuse conflicting operator override; retain fixed installation identity |
| R3 | Export destination could overwrite active inventory outside mutation pipeline | Refuse equal resolved source/destination; retain native private-material review |
| R4 | Numeric/boolean YAML credential literals were not masked | Mask all scalar credential values; add numeric-secret round-trip acceptance |
| R5 | Older HUD failure left dependent editor controls active | Disable controls without an authoritative snapshot; keep Reload available |
| R6 | Discarded import draft could remain in hidden YAML control | Reset control on accepted import preview; drafts never enter setState |
| R7 | Invalidation after setup execution could be classified simply as failed | Record unknown and refuse automatic replay until inspected |
| R8 | BGP renderer needed stronger spatial readability | Shaded facets, visible node labels and depth, retaining semantic fallback |

Acceptance fixture corrections are distinct from product findings: private UUID identity for owned daemon; existing openDomain command for topology; attached-state assertion for native select options; keyboard type-ahead for macOS selects. No approval or target safeguards were removed to pass tests.

## Security amendment analysis — before source changes

Seven added requirements (FR-028–033, SC-009) map to T033–036; all original35 remain covered. Findings resolved in the design/contract before implementation:

| ID | Finding | Resolution |
|---|---|---|
| S1 | A security perimeter can be shared across installations | Native explicit target binding and scope labels; runtime identity does not imply exclusive ownership |
| S2 | Historical tool syntax does not match all current vendor versions | Probe capabilities/schema; modern config writer and connector semantics only; unsupported writes unavailable |
| S3 | Effective OpenShell policy includes provider/global state | Read effective + base separately; mutate base network only; global/unknown source read-only |
| S4 | OpenShell lacks an exposed CAS write flag | Immediate pre-apply revision comparison, shared-target serialization and explicit external-writer limitation; post-read verification |
| S5 | Allow/mode changes can weaken protection | Native specific weakening acknowledgment and mandatory reason; no implicit lifecycle/disable |
| S6 | Security output may contain private payloads | Bounded projection/log redaction, private originals/evidence, no raw child errors or persisted webview drafts |

Amendment analysis result:0 unresolved design findings;42/42 requirements mapped. T033 complete; implementation follows the amended contract.

## Final implementation and consistency pass

Read-only review of the final spec, plan, tasks, contracts, code, evidence and constitution identified the following additional implementation/documentation issues. The owner's existing instruction authorized the subsequent fixes; all were rechecked before handoff.

| ID | Finding | Resolution / evidence |
| --- | --- | --- |
| R9 | Staged setup could inherit a different target environment | Clear targeting variables and explicitly pin reviewed paths; setup acceptance passes |
| R10 | Malformed interrupted evidence could permit another operation | Unreadable/running/unknown records block execution; fault tests pass |
| R11 | Extra operation fields could obscure requested inventory changes | Strict operation field allowlists and rejection tests |
| R12 | Export alias paths or partial writes could damage active inventory | Resolve source aliases, reject same inode/hardlinks, use private atomic export; export tests pass |
| R13 | Long RAG state and Avatar grid could overflow narrow editor | Wrapping and minimum-width fixes; full native width matrix passes |
| R14 | Setup phases and old fixed-baseline test wording overstated evidence | Persist controlled phases; label current-worktree source tests accurately |
| S7 | Security review lacked concrete before/after fields | Bounded redacted structural differences displayed before native confirmation; adapter/editor assertions |
| S8 | Inherited interpreter options or native update checks could alter invocation | Clear interpreter injection variables; pin product scope and suppress DefenseClaw update checking |
| S9 | DefenseClaw status could identify a different data directory | Matching native-reported scope is required for edits; mismatch test stays read-only |
| S10 | Large network policy and failed refresh could leave misleading editing controls | Explicit128KiB limit/read-only fallback and refresh failure disables edits; adapter/DOM coverage |
| S11 | Read-only rule views disabled search/pagination | Keep inspection controls active; DOM acceptance covers120 rules |
| S12 | Security cards exposed raw network objects as primary summaries | Human-readable endpoint/access/enforcement/binary summaries; advanced JSON stays explicit |
| D1 | Main artifact summaries still described only original five stories | Update scope to six stories, documentation, final evidence and task mappings |

Additional requirement mapping:

| Requirement | Covered | Tasks |
| --- | --- | --- |
| FR-028 | Yes | T033, T034, T035 |
| FR-029 | Yes | T033, T034, T035 |
| FR-030 | Yes | T034, T035 |
| FR-031 | Yes | T034, T035 |
| FR-032 | Yes | T034, T035, T036 |
| FR-033 | Yes | T034, T035, T036 |
| SC-009 | Yes | T034, T035, T036 |

Final result: **42 requirements,36 tasks,100% requirement-to-task coverage;0 unresolved analysis/implementation findings,0 unmapped tasks,0 unresolved ambiguities/duplicates and0 constitution conflicts within the approved local scope.** Six stories and six clarification decisions are reflected in the final artifacts. Native security controls expose existing integrations to the operator; they add no assistant tool authority, MCP registration or installer component. Owner-authorized local source work and isolated fixture mutations preserve the live-environment/distribution hold. Unexecuted vendor/platform qualification and OpenShell's upstream concurrency limit are documented scope limits, not claimed passes. Final outcomes and reproducible evidence are in verification.md.
