# Mac return: three installer acceptance passes

**Result: 3/3 scenarios passed on 2026-10-24.** This closes the owner's requested additional local Mac installer test scope. The owner explicitly excluded operational capability retesting.

Tested candidate: `575bb084a8ca54c629b8f39434539cbd10597065`, including the seven WSL-return implementation fixes. No product source changes were needed during these passes. The original checkout stayed clean on `153-ide-installer` at `89627477fb470cd7c293e33e192c5983819d45d4`; qualification used a separate worktree.

## Actual installation results

| Pass | Actual exercise | Result |
| --- | --- | --- |
| 1 | Empty runtime home, OpenClaw 2026.7.1-2, subnet component; native VS Code source/plan review and Apply | 11/11 phases verified; Tiers 1–3 verified; one connection candidate saved and selected; overview showed ready. |
| 2 | Empty runtime home, Hermes v0.21.6; cancel native review, apply, pause at the verified runtime checkpoint, explicitly resume the same run and exact plan | Cancellation created no runtime home. Resume completed 11/11 phases and Tiers 1–3. The companion resolved to the installation's managed Python 3.14.3. One connection candidate saved and selected; overview showed ready, installed and authenticated. |
| 3 | Four empty homes: OpenClaw Border, OpenClaw hot member, Hermes hot member, OpenClaw on-demand member | 52/52 phases verified. All four claws passed Tiers 1–3 and installer Risk readiness, including enrollment/identity and authenticated hot-member self-status. Four connection candidates appeared; the Border was saved and selected, and its overview showed ready. The on-demand gateway/HUD were loaded and its federation worker remained stopped. |

Native plan acceptance cleared the previous run's displayed status before starting each new run. Completed focused installations retained their six checked configuration/identity hashes while the Risk installed alongside them.

These were actual pinned installers and native VS Code flows, operated by CUA with synthetic engineering inputs. Plans used credential-free local provider configurations, no conversation channels and no device inventory. Tiers 4–6 were not selected: no model sessions, channel messages or device calls ran. Provider execution and on-demand work execution were not claimed. Installed readiness is the completion boundary for this record.

The host was macOS 26.5.2 arm64 with an isolated VS Code 1.109.0 profile, Node 24.19.0 and uv 0.10.12. The first wizard had no saved installations or default runtime homes. These were fresh installation homes on an existing Mac; the earlier clean-OS VM bootstrap evidence remains separate.

## Fixture correction and regression

An initial disposable OpenClaw attempt stopped at `configuration_required` when the isolated launch PATH omitted uv. Its attempted resume remained `unknown`; that state was preserved. VS Code's GUI shell environment also exposed ambient unsupported Node 25.3.0. The test launcher was corrected to retain the qualified private tool PATH, and the successful OpenClaw pass used a new empty home. No journal state or product approval was overridden. The initial fixture later received verified owned cleanup.

- Extension type check/build passed; 136 tests passed, zero failed, three explicit skips (native OpenClaw custom-agent opt-in, Linux service timezone, cached RAG embeddings).
- Of 140 setup cases, 138 passed including the actual pinned Hermes and Specify follow-ups. Two native WSL-only cases were skipped on Mac. No failures.
- Installer regression: 216 passed plus 16 subtests.
- Catalog metadata, generated parity and coverage passed: 110 components, 237 skills, zero unexplained gaps.

## Preservation and cleanup

The owner's configuration hashes and existing native service PID stayed unchanged. The original Git branch, HEAD and clean working tree were preserved.

All three completed runs received verified owned cleanup. OpenClaw removed 1,516 listed files, Hermes 1,517, and Risk 6,076. Only their six ownership markers were retained among listed artifacts. The initial unsuccessful fixture also received verified cleanup. No `netclaw-mac3-*` services remain loaded. Private dependency directories and audit evidence remain by design; the disposable editor was closed.

[Sanitized evidence](evidence/mac-return-three-pass.json) includes the redacted Claw Reports, plan hashes, completed-journal hashes, cleanup counts, preservation comparisons and test-log hashes. Raw journals, generated credentials and logs stay local. The evidence was checked for private home paths and credential fields before inclusion.

This record establishes the requested Mac installer acceptance. It does not relabel incomplete Windows/WSL installer scenarios, change T081/T082/T084, or claim release approval. No merge, publication or owner runtime deployment occurred.
