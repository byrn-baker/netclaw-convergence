# Pre-implementation consistency analysis

2026-09-27: reviewed ratified decisions against spec, plan, tasks and constitution. No blocking ambiguity remains.

| Finding | Resolution |
| --- | --- |
| A125-001 Ordinary RISK member would create redundant frontier agent | Model dedicated advisor service explicitly; preserve routing eligibility |
| A125-002 Static packs conflict with user decision5 | Removed; Border dynamically composes questions, server validates structure only |
| A125-003 Caller task IDs could reset per-case cap | Trusted runtime/operator binding; conservative shared fallback |
| A125-004 Model boolean cannot establish disclosure approval | Operator-only exact digest/endpoint/task/expiry consent |
| A125-005 Provider timeout may still incur charge | Retain conservative reservation; no hidden automatic retries |
| A125-006 Automatic decision detection cannot be inferred in transport | Put semantic consultation instruction in actual Border persona; do not promise hard enforcement |
| A125-007 Agreement can be mistaken for correctness | Display model support and evidence boundaries, not guaranteed outcome |

Coverage: FR001 T003/T007/T008; FR002 T003/T009; FR003 T008/T009; FR004 T008/T011; FR005 T006; FR006 T006/T009; FR007 T003/T007; FR008 T005; FR009 T004/T007; FR010 T003/T011; FR011 T006; FR012 T007–T010. Post-implementation findings and verification to follow.

## Implementation review findings

- A125-008: JSON credential keys were not covered by a raw-text regex. Added recursive key checks and quoted assignment handling; tests required.
- A125-009: Switching provider could forward the hosted key. Separate endpoint-bound compatible credentials; blank setup preserves only a same-destination compatible key.
- A125-010: Empty template price prevented hosted defaults. Empty means absent; custom endpoints still require explicit price.
- A125-011: Private ledger/settings symlink paths could escape intended storage. Reject symlink targets and test refusal.
- A125-012: Provider billing beyond the supported bound must not be silently undercounted. Record reported cost and block subsequent evaluations pending operator investigation. Caps assume configured provider price/context contract.
- A125-013: Shared guide relative links must resolve after Border workspace generation; generator now provides the non-overwriting documentation link.
- A125-014: Skills now explicitly classify all private state/questions/metadata and treat member content as evidence, not instructions.

Independent synthetic scenario review: controller timeout versus responsive device, favorable review without approved CR, and unavailable specialist judgment all retain evidence/authorization boundaries.

Validation runner note: direct monolithic `pytest tests/unit` fails collection because existing RAG/Three.js/ComfyUI tests reuse module names (`storage`, `materials`, `topology_model`). The declared unit suite already uses per-file isolation; rerun through scripts/run-contract-tests.py, without changing unrelated tests.

Live hosted smoke: one real MCP evaluation returned all three primitive types from pinned jev-1.13.0,465input/71output tokens, $0.00001953 at configured rate, 0.927s including MCP/audit. Actual GAIT commit d979dd8b. Synthetic evidence only; domain calibration not inferred.

## Final analysis

All14tasks completed against the bounded feature scope. FR001–012 each map to implemented code/skills and acceptance evidence in verification.md. No blocking design finding remains. User steering preserved: basic HUD wiring only, detailed Adam canvas integration handed off. No static question library, authority escalation or unrelated audit expansion.60targeted Jev checks included in563passing isolated unit tests;542federation and230HUD checks pass. Live synthetic provider compatibility passes with actual GAIT audit. Remaining operational limits are explicit, not marked as verified network accuracy.

## WSL adoption follow-up — 2026-09-27

User requested a concrete WSL upgrade handoff and then authorized commit/PR/merge/branch deletion/main. Read-only installed-path review found hidden interactive prompts and missing registration on existing configs. Scope adds preview/apply/conflict-safe recovery for Jev-only MCP registration and Border persona/skills, plus explicit env-file loading for the registered process. No actual WSL deployment is claimed. Preserve existing RISK identity/configuration and keep HUD changes basic. Revalidate affected paths before merge.
