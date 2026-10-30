# Cross-artifact analysis and remediation

Date: 2026-10-17. Inputs: spec.md, plan.md, research.md, data-model.md, contracts/, tasks.md, task-coverage.json and constitution 1.2.1. The analyze pass was read-only; remediation followed separately under the owner's explicit instruction to address all findings before implementation. Optional auto-commit hooks remain disabled.

## Initial findings

| ID | Category / severity | Location | Finding and remediation |
| --- | --- | --- | --- |
| A1 | Inconsistency / medium | plan.md Project Structure | Stale R9/R12 choices and setup.ts name collided with research. Resolved actual catalog/skill paths, namespaced setup-wizard.ts and explicit VSCode1.109 context. |
| A2 | Coverage / high | contracts/component-catalog.schema.json | Schema covered components/skills but omitted harness/provider/channel/shape/security cards. Added canonical choice descriptors, version ranges, fields and provenance; expanded T006. |
| A3 | Security underspecification / high | plan posture / engine contract | User-supplied requiredControls could be empty. Defined engine-owned minimum policy plus additions, fixed observation and unsupported-control refusal; T042 implements/tests policy. |
| A4 | Authority inconsistency / high | verification schema/spec US3 | Plan booleans could be mistaken for live-call/message approval and tiers1–3 could be omitted. Required semantic mandatory tiers, separate native consent/per-message review; corrected single-call wording; T046/T048 cover it. |
| A5 | Data underspecification / high | setup-tools Draft / plan schema | Fully required schema could force fabricated values for incomplete intents. Defined bounded partial DraftInput using identical closed fields, explicit missing diagnostics and no schema-valid/apply claim; T069 covers fixtures. |
| A6 | Secret scope ambiguity / high | secret reference source=existing | Could imply reading another claw. Restricted existing to this run's owned env on resume; explicit separate refs for deliberate sharing. T018/T021/T053/T056 test isolation. |
| A7 | Validation underspecification / medium | engine/catalog contracts | Limits and conditional-expression shape were not normative. Added byte/depth bounds, closed recursive all/any/equals/present condition schema, source filter/config protections and no remote refs/eval. T006/T013/T014/T033/T035 cover them. |

## Re-analysis

All seven findings are addressed in the design artifacts and task acceptance. Rechecked duplication, ambiguity, underspecification, constitution alignment, coverage and terminology/dependency consistency. No unresolved critical/high/medium/low finding remains at the pre-implementation design gate. This does not assert code correctness or runtime acceptance; later implementation findings must be fixed and tests rerun.

Current constitution is unchanged. Generated shell entries, installer functions and coverage remain required, so the prospective XI amendment is not a dependency or exception. Network writes, external messages, production installs and publication are outside fixture scope. Latest owner instruction supersedes earlier G1/G2 stops; G3 preview and separate distribution authorization remain.

Metrics: 56 functional requirements; 14 success criteria; 84 sequential unique tasks; all 12 stories; FR coverage 100%; SC coverage 100%; zero unmapped tasks; zero unresolved ambiguity/duplication/critical findings. Broad shared qualification tasks do not replace concrete story tasks.

## Coverage summary

| Requirement | Tasks |
| --- | --- |
| FR-001 | T027, T031 |
| FR-002 | T027, T028, T031 |
| FR-003 | T028, T031 |
| FR-004 | T029, T031 |
| FR-005 | T030, T031 |
| FR-006 | T030, T031 |
| FR-007 | T033, T034 |
| FR-008 | T019, T033, T034, T035 |
| FR-009 | T033, T034, T035 |
| FR-010 | T014, T033, T035 |
| FR-011 | T025, T036, T037, T038 |
| FR-012 | T006, T013, T020, T036, T037, T039, T040, T059 |
| FR-013 | T005, T006, T038 |
| FR-014 | T005, T006, T038 |
| FR-015 | T005, T006, T007, T038 |
| FR-016 | T039, T040 |
| FR-017 | T036, T038, T039 |
| FR-018 | T053, T054 |
| FR-019 | T053, T055, T056, T057, T059 |
| FR-020 | T007, T013, T053, T055, T056, T057, T059 |
| FR-021 | T018, T019, T021, T041, T053, T055, T056, T059 |
| FR-022 | T053, T058, T059 |
| FR-023 | T013, T015, T022, T041, T042, T053, T057, T058, T059 |
| FR-024 | T006, T021, T036, T038, T041, T055 |
| FR-025 | T016, T018, T019, T021, T025, T041, T043, T060 |
| FR-026 | T013, T014, T018, T021, T041, T069 |
| FR-027 | T013, T016, T018, T021, T029, T036, T041, T043, T046, T049, T060, T061, T069, T072 |
| FR-028 | T013, T014, T017, T025, T037, T041, T042, T068, T070 |
| FR-029 | T015, T017, T020, T024, T043, T044 |
| FR-030 | T015, T017, T024, T025, T042, T043, T068, T071, T075 |
| FR-031 | T010, T019, T020, T021, T024, T026, T056 |
| FR-032 | T020, T043 |
| FR-033 | T015, T016, T017, T022, T023, T043, T044, T045, T058 |
| FR-034 | T013, T015, T016, T019, T021, T023, T032, T033, T035, T045, T051, T052, T056, T057, T074, T075 |
| FR-035 | T015, T022, T023, T044, T045, T047 |
| FR-036 | T046, T047, T048, T058, T059 |
| FR-037 | T046, T047, T048, T049, T072, T076 |
| FR-038 | T047, T050, T052 |
| FR-039 | T047, T050, T052 |
| FR-040 | T060, T061, T062, T063, T065, T066 |
| FR-041 | T060, T061, T062, T066, T069, T071, T073 |
| FR-042 | T064, T065, T066, T067, T070 |
| FR-043 | T067, T068, T069 |
| FR-044 | T063, T064, T066 |
| FR-045 | T070, T071, T072, T073 |
| FR-046 | T009, T024, T025, T026 |
| FR-047 | T014, T024, T025, T026, T042, T066 |
| FR-048 | T005, T006, T007, T008, T009, T010 |
| FR-049 | T005, T009, T011, T012 |
| FR-050 | T005, T007, T008, T011 |
| FR-051 | T074, T075, T076 |
| FR-052 | T038 |
| FR-053 | T030, T033, T034, T040, T042, T071 |
| FR-054 | T065, T067 |
| FR-055 | T023, T032, T035, T050, T051, T052 |
| FR-056 | T023, T050, T051, T052 |
| SC-001 | T020, T027, T030, T033, T034, T038, T039, T040, T047, T048, T050 |
| SC-002 | T001, T002, T004, T077, T083, T084 |
| SC-003 | T027, T028, T029, T030, T031 |
| SC-004 | T014, T017, T019, T020, T021, T024, T025, T026, T037, T042, T047, T062, T063, T066, T067, T068, T069, T070, T073 |
| SC-005 | T013, T014, T016, T018, T019, T021, T025, T029, T031, T036, T039, T040, T041, T043, T046, T048, T049, T053, T056, T058, T060, T061, T062, T064, T066, T069, T070, T071, T072, T073, T076 |
| SC-006 | T005, T006, T007, T008, T009, T010, T011, T012, T038 |
| SC-007 | T013, T015, T016, T017, T020, T022, T023, T037, T043, T044, T045, T058, T061, T074, T075 |
| SC-008 | T013, T015, T018, T022, T041, T042, T053, T055, T056, T057, T058, T059 |
| SC-009 | T017, T025, T042, T046, T048, T060, T061, T062, T063, T064, T065, T066, T067, T068, T069, T070, T071, T072, T073 |
| SC-010 | T053, T054, T055 |
| SC-011 | T036, T038, T055, T076 |
| SC-012 | T005, T007, T009, T010, T015, T016, T019, T021, T023, T024, T026, T027, T030, T032, T033, T034, T035, T045, T047, T051, T052, T057, T065, T074, T075 |
| SC-013 | T038, T044 |
| SC-014 | T013, T015, T016, T019, T021, T023, T032, T033, T035, T047, T050, T051, T052, T056, T057, T059, T074, T075 |

## Implementation analysis checkpoint

The initial seven design findings were remediated before code. Subsequent implementation checks are distinct and are not represented as clean-host acceptance.

| Finding | Resolution / remaining state |
| --- | --- |
| Missing UI/companion/BGP collision keys | Both schemas and frontends now require seven unique ports; new Risk listeners bind loopback. |
| Mutable shared checkout / executable Git filters | Per-claw copied source/build/cache; raw Git tree/index fingerprints; source acquisition exclusive claim. Actual Git fixtures prove filter non-execution and Python/editor hash parity. |
| Generic exit-zero or interpreter fallback could imply readiness | Dependencies require actual owned launch artifacts. Fixed stdlib wrappers use the owned bootstrap Python and inspect their real Node/Go/script target; Python servers require component runtimes. |
| Native service source drift | Private digest/count-bound source index checked before launch, observation and editor management; aliases and escapes refused. Downloaded dependency trees remain separately qualified. |
| HUD readiness race | Both API and UI listeners must be ready and owned. Actual managed OpenClaw/Hermes fixture tests pass. |
| On-demand member lifecycle split | Management services stay hot; the worker wakes through its owned native controller, preserving one lifecycle owner. Actual Mac native on-demand wake and idempotence now pass; WSL remains to qualify. |
| Provider/channel uncertainty could advance verification | Native per-attempt review, durable unknown intent, receipt verification and no replay; unknown stops later checks. Destination inputs are nonce/hash-bound and never public progress. |
| Editor EOF during native prompt / Python input-thread shutdown | Socket shutdown wakes prompts immediately; bounded descriptor polling replaces a blocking buffered daemon reader. Actual child-process tests pass. |
| Incidental stencil/model downloads | Sketchfab is explicitly opt-in; private Hugging Face caches/offline flags prevent incidental model fetch. Model downloads with unknown transfer size defer to the model manager. |
| Hermes model/identity mismatch | Exact native provider/API projection and reviewed identity manifest. Native workspace save now binds and updates the identity manifest with a private backup; partial two-file saves remain unknown. Actual protected-loader fixture passes. |
| Advisor omitted its interview | Five bounded native questions now feed versioned 153.2 estimates, reasons and both-shape comparisons. No plan mutation or approval; unknown context tokens stay unknown. |
| Temporary preview HOME caused Keychain popup | Cancel; isolated macOS editor uses Electron's test-only mock keychain. No owner keychain reset. |
| Real controlling terminal could not open buffered r+ | Raw duplex text stream now supports non-seekable PTYs. Both harnesses pass actual terminal/editor transport parity with private secret capture and matching real manifests/registrations/honest readiness. |
| Windows gate omitted the WSL extension prerequisite | Native extension check precedes fixed probes; specific stop guidance and a bundled guide are present. WSL1/error/ambiguous identity and cancellation fixtures have zero handoff effects. |
| Cleanup could race management, lose enable-link ownership or abandon on expired review | Exact owned service stop/removal, journaled WSL enable links, shared management mutex, unknown-lock retention, per-item outcomes and readiness invalidation are implemented. Actual Mac reviewed cleanup/preservation now pass; WSL remains to qualify. |
| WSL formatted argv lost boundaries and dollar paths expanded | Fixed read-only GetUnit/ExecStartEx JSON observation binds executable, complete argv and execution flags. New units disable environment expansion. Python/editor share 18 positive/adversarial cases; native manager qualification remains open. |
| Partial file phase could become completed from a matching artifact prefix | Home/skills/identity now enumerate the complete selected outputs, with reviewed repair only for missing owned files and no rewrite of settled private files. Inventory/registration remain unknown without complete postcondition evidence. Crash/review/foreign-file fixtures pass. |
| Source-copy crash could not distinguish copying from package-manager execution | Durable source/dependency stage checkpoints permit exact owned copy repair only before acquisition starts. A real journal/reopen fixture verifies that no package manager runs before a fresh review. |
| Runtime version banner and old component checkpoint could hide missing dependencies | Resume/Tier 1 re-observe owned launch artifacts and pinned Python imports. HUD verification checks every direct locked version, the complete offline npm runtime tree and actual imports. A real disposable install passes, fails after a dependency is removed, then passes after restoration. |
| Local MCP helper used old SDK field names and forwarded unnecessary credentials | Actual ANTA MCP execution exposed the Python 2.3 snake_case result API. Both setup helpers are fixed and tested with real pinned result objects. Local canaries strip credentials/overrides and prevent dotenv loading; member status must match the selected installation identity. |
| Catalog drift / artifact coherence | Metadata includes actual field provenance, kind/access/estimate qualifiers and external dispositions. Coherence matrix and six guides are written; original 237 operational skills preserved. |

Current effect inventory: 89 scoped shell adapters, four isolated Python adapters, 15 scoped special adapters and two explicit native/platform dispositions. The certificate adapter uses the existing X.509 primitives in isolated cryptography 46.0.5, with complete pair recovery and independent key/signature/identity/time validation; no ACME or trust/enforcement claim. Pinned gtrace v0.15.1 is built in a disposable prefix and version-probed; no packet/tool request. Default structural reports, seven-case assistant intent fixtures and the actual pinned Spec Kit preset are verified within their stated scope.

**Current disposition:** Mac native interaction/recovery, supported canaries, clean OS, installed clients and synthetic usability now have the evidence listed in verification.md. Incompatible Webex, unqualified production controls and platform-only components refuse or disclose their supported boundary. Optional live resources were not selected. These are explicit scope dispositions, not false successful installations. WSL/native Windows and the final owner walkthrough remain later gates.

## Targeted reanalysis — 2026-10-18

The owner explicitly replaced SC-002's five recruited participants with synthetic usability checks and an owner/build-agent walkthrough, with community feedback after release. The active spec, plan, tasks, quickstart and verification agree; supplied input documents remain unchanged. Other success criteria remain in force.

Actual isolated Mac execution exposed two compatibility/readiness findings, both addressed before repeating acquisition: pinned Hermes provides `hermes_yaml` rather than PyYAML's `yaml`; native service acknowledgement precedes authenticated companion readiness. The adapter now uses the pinned loader and bounded actual readiness polling before discovery. Tests exercise the real pinned interpreter, delayed readiness, deadline, cancellation and identity mismatch. Fresh Hermes and OpenClaw runs then reached Tiers 1–3 without live provider/channel/device calls.

An additional SC-007/FR-032 review found Apply/Resume could step past an unsettled onboarding prerequisite. Both paths now block later effects until onboarding is verified; regression cases cover configuration-required, unverified and skipped outcomes. The later engine-owned PTY adapter and actual terminal cancellation/descendant-lock tests complete the native interaction path.

That earlier checkpoint covered fresh homes only. The final Mac evidence separately establishes clean-OS Minimal wizard, both harness wizard journeys, installed client discovery and all four local Risk pairings. It does not claim hosted provider execution, qualified production controls or a human walkthrough. No finding is closed solely because a handoff exists.


## Final Mac reanalysis — 2026-10-18

Read-only cross-artifact review followed by the owner-authorized remediation and affected tests found and resolved these additional issues:

| Finding | Resolution and verification |
| --- | --- |
| Mac prerequisites could leave an otherwise fresh machine unable to continue | Fixed allowlist package action, pinned/SHA-checked official Homebrew bootstrap, native terminal confirmation and reviewed prepared PATH. Actual clean VM flow passed. |
| GAIT installed but lacked its component runtime record | Journal-owned generation/record, pinned real imports and bundled source checks; foreign links and unjournaled replacements refuse. Fresh Minimal native discovery passed. Probe imports only GAIT's required dependencies, not an unrelated HTTPX dependency. |
| pyATS discovery required a testbed even when no devices were selected | New private empty `devices: {}` testbed only when pyATS is selected and no inventory supplied. Refuses occupied files; actual Minimal discovery and regression passed, no device call. |
| Native Hermes registered components outside companion allowlist lacked discovery evidence | Owned live native agent registry, initialized sessions/tools and no cached/foreign success. Both mixed Risk compositions passed without broadening companion access. |
| Service interpreter symlink differed between setup and management | Canonical native descriptor interpreter; actual Border/OpenClaw/Hermes management and neighbor preservation passed. |
| Validation disappeared on final snapshot refresh | Validation retained only for the same plan hash. Blank wizard validation/Apply journey passed. |
| Plan review obscured live progress | Wizard revealed after native review before execution; actual visible progress and 29 measured 0–14ms delivery/render samples passed. |
| Cleanup misclassified TIME_WAIT and a disappearing launchd job | No SO_REUSEPORT; active listeners still refused. A second successful manager list proves disappearance. Real TCP and race regressions plus actual reviewed cleanup passed. |
| Old handoff/status documents described incomplete Mac work as transferable | Reconciled fixed eight-row gate, 81/84 original task count, Windows-only remaining matrix and return contract. Old archive remains explicitly obsolete; new overlay is independently imported and checked. |

Final consistency: 84 unique task IDs, 56 FR and 14 SC mapped; schema/catalog parity and build/tests pass. No unresolved critical/high/medium/low implementation finding in the frozen Mac gate. This statement excludes unexecuted Windows/WSL qualification and final cross-platform closure. The explicit unsupported/optional dispositions remain visible. Human comprehension time is not inferred from automated keyboard benchmarks. Downloads are reported as measured acquisition phases, with wire-only time explicitly unavailable.

## WSL return reanalysis — 2026-10-24

The accepted Mac gate and specification decisions are preserved. [wsl-findings.md](wsl-findings.md) records W153-001–013 and the unsuccessful attempts. Actual WSL execution required fixes for literal systemd environment/working-directory behavior, kernel-based Linux process ownership, private managed Python, stale prior-run display and an inactive on-demand unit collected between observations. The native PTY survivor test needed Linux SIGHUP handling. The final source is `cf97be1c286442660c355d50cf0788199a24c2a1`; the final setup suite passes 140 tests with zero skips on both systemd 255 and 259.

The cold-wake change accepts absence only through a successful exact-name typed manager listing, only in the on-demand start path. It checks the owned definition before starting and verifies loaded typed argv afterward. Failed/malformed listings, changed definitions, foreign loaded argv and altered post-start argv still refuse. Actual native tests prove cold wake and repeat-wake PID preservation. The full mixed Risk rerun remains blocked after loss of its RAM fixture; isolated manager tests do not replace that acceptance.

The complete matrix is intentionally not closed. Ubuntu 24.04 Hermes was interrupted during verification and remained unknown; installed-client discovery, new Risk/management and deliberate restart cases are outstanding. Native Windows OS variants were unavailable, and actual expiry/wrong-host cases were not executed. Physical disk exhaustion, interop timeouts, an unexplained initial neighbor comparison and conservative cleanup outcomes remain visible. No private state was rewritten to manufacture completion.

The owner requested remote delivery and return to Mac, then cautioned against destabilizing the shared system. Qualification proceeded serially through small affected regressions and reviewed cleanup, with further provisioning/restart exercises stopped. [SUMMARY.md](../../spec153-wsl-return/SUMMARY.md) and [RETURN-TO-MAC.md](../../spec153-wsl-return/RETURN-TO-MAC.md) identify affected Mac regressions, exact source transport and remaining gates. T081/T082/T084 remain unchecked; final merge/readiness and publication are not inferred from a green unit suite or this handoff.
