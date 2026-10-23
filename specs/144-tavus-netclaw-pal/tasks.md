# Tasks: NetClaw Pal

Status: closed for the local Avatar scope on 2026-10-09. Unchecked hosted and expanded-product tasks below are deferred follow-up work, not failed or completed local-release criteria. Historical counts describe their original runs; final closeout evidence is in verification.md.

## Exploration completed

- [x] T001 Read project guidance and prior memory; create/check out GAIT session branch.
- [x] T002 Preserve branch 143 as a local archive; return to up-to-date main and retain the unrelated MSP document.
- [x] T003 Review Tavus official pricing, PALs, tool delivery, MCP connectors, custom LLM, Echo and conversation lifecycle docs.
- [x] T004 Validate the existing key through three read-only inventory calls; do not create a conversation.
- [x] T005 Inspect NetClaw HUD dispatch, bindings and federation gateway; document compatibility gaps.
- [x] T006 Write spec, research, plan and ordered tasks without implementing the feature.

## Prerequisites and acceptance gates

- [x] T007 Review and ratify scope, local bridge choice, read-only enforcement and permitted outbound data.
- [ ] T008 Verify exact Free entitlements, remaining allowance and billing/cleanup semantics without activating a paid plan. Stop if any required feature is excluded.
- [ ] T009 Finish live SDK/app-message playback and gateway runtime acceptance. Official schemas, installed runtime source, isolated MCP startup and local event fixtures are verified; actual model/provider round trip is pending.

## Implementation

- [x] T010 Create an isolated feature branch from current main; add optional installer/configuration scaffolding.
- [x] T011a Implement local MCP facade, fixed agent routing, isolated workspace and all-tools-denied policy. Test weakened policies and private bootstrap rejection.
- [ ] T011b Add scoped operational read tools and selected-target authorization; prove their runtime enforcement before enabling User Story 2.
- [x] T012 Implement private operator/conversation/task binding, bounded requests, replay defense and revocation.
- [x] T013 Implement atomic durable budget reservations, provider caps, no-blind-retry creation and restart/termination reconciliation. Verified with fixtures; provider billing bounds remain T008/T020.
- [x] T014 Implement deterministic outbound projection and local-only evidence rendering; verify sensitive fixtures cannot leave.
- [x] T015 Implement provider PAL/tool setup with explicit result behavior and eligible stock selection; store only resource IDs locally. No live conversation during setup.
- [x] T016 Add opt-in HUD panel, explicit start/end, camera-off default, visible allowance and factual pending/error states.
- [x] T017 Add task deadlines, interruption handling, app-message size checks and stale-result suppression.
- [x] T018 Complete skill, README, SOUL, TOOLS, `.env.example`, optional installer, catalog and HUD coherence. Facade is deliberately HUD-invoked and absent from the main agent MCP registry to avoid recursive dispatch.

## Acceptance and release

- [x] T019a Run local verification: 18 Pal JavaScript tests and four Python tests pass; production build, spec/catalog/inventory/skill/dependency checks pass.
- [ ] T019b Complete visual and platform acceptance. Full HUD suite: 339/340 pass; existing non-default-loopback test fails with macOS `EADDRNOTAVAIL` for `127.0.0.2`. Browser policy blocked local preview navigation; visual inspection remains pending.
- [ ] T020 On explicit live-test authorization and verified budget, run one at most 120-second synthetic conversation. Measure response latency and usage; confirm ended status.
- [x] T021 Report tested versus untested capabilities, limitations, provider allowance and remaining work. Keep operational reads disabled until prerequisites pass.
- [x] T022a Record GAIT/daily memory and implementation evidence.
- [x] T022b Under the owner's closeout instruction, narrow the release to local Avatar plus disabled experimental hosted foundation and prepare the minor-version release metadata. Hosted acceptance remains deferred.

## Expanded product direction and local alternative

- [x] T023 Capture the five owner decisions and separate approved design from first-slice implementation in distribution-design.md.
- [x] T024 Inspect John's supplied HEIC, convert to docs/john.png and visually verify the PNG locally. No upload or training.
- [x] T025 Research voice input formats, paid custom-face boundaries, LiveAvatar alternative and Blender/browser rendering; record recording guidance and local runtime findings.
- [x] T026 Owner chose the local-first prototype with John and Lobster; existing configured frontier model supplies answers, local speech/animation supplies presentation.
- [ ] T027 Implement shared profile/account/binding configuration, own-key onboarding and optional John pack; validate separate owner accounts.
- [ ] T028 Replace restricted ingress with authenticated Border tasks and typed non-sensitive automatic speech; prove approval, scope and private-data regressions.
- [ ] T029 Support optional provider member placement with existing enrollment, truthful capability status and one authoritative account ledger.
- [ ] T030 Record and audition John voice; complete optional media manifest/usage notice. Any hosted training requires verified entitlement and its own bounded authorization.
- [x] T031 Build and inspect two original Blender GLBs with a shared rig; render and inspect previews, merge static geometry and validate embedded assets.
- [x] T032 Add local selector/renderer as the fourth Avatar Chat interface, preserve the same thread and keep Tavus optional. Place character left/chat right and controls below; add orbit, pan, zoom/reset.
- [x] T033 Add authenticated bounded local synthesis, audio-driven animation and explicit playback/stop controls; default automatic speech remains non-sensitive summaries.
- [x] T034a Verify local speech, asset contract, privacy/ownership/cancellation, chat preservation and production build. Full suite retains the existing Mac 127.0.0.2 failure; see local evidence.
- [ ] T034b Complete live browser visual/audio acceptance: browser automation blocked localhost with ERR_BLOCKED_BY_CLIENT. Owner subsequently confirmed the initial avatar/audio works well. The final polish still needs live viewport/audio review; fixture tests are not browser acceptance.
- [x] T035 Repair disabled gateway HTTP endpoint and unsupported model/history RPC arguments; verify authenticated default-model/effort round trip and owned history via real APIs.

- [x] T036 Complete ten explicit Ralph polish passes with activation/cancellation, preferences, long-answer reading, controls, motion, accessibility, graphics recovery and integrated verification; see ralph-polish.md.
- [x] T037 Research open-weight own-voice models and document a recording/integration plan using primary model cards.
- [ ] T038 Future slice: receive a local reference recording/transcript, benchmark a pinned MLX voice model and implement owner-scoped voice profiles before enabling cloning.

## Closeout

- [x] T039 Review the local-first scope, preserve deferred tasks and write final verification/compatibility limits.
- [x] T040 Re-run HUD tests/build, Python boundary tests and repository declaration checks; report the existing macOS loopback fixture failure precisely.
- [ ] T041 Create the requested PR, pass applicable Linux CI, merge, and return to main before creating spec 145.
- [x] T042 Repair stale installer fixtures exposed by integrating current main; preserve pip failure/credential/isolation assertions and re-run affected suites.
