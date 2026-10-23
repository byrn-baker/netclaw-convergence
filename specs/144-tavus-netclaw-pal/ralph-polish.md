# Avatar polish — ten Ralph passes, 2026-10-09

Scope: improve the existing local John/Lobster Avatar mode, preserve shared Chat,
configured frontier model and approvals, keep default speech non-sensitive and
local, and research an own-voice model for Apple Silicon.

The installed Ralph setup script initialized a ten-iteration prompt. Its stop
hook targets Claude Code; this Codex session executes the same inspect → edit →
verify workflow explicitly, with results below. These are not ten spawned agents
or fabricated automatic hook invocations. No claim of absolute perfection.

## Iteration record

Each entry records the finding, change and actual verification after completion.

1. **Activation and visible state.** Sending in Avatar unlocks Web Audio during
   the user gesture; a confirmed reply then speaks the default fixed notice.
   Voice-off/ready/preparing/speaking states replace misleading Ready. Manual
   playback also finds the latest saved assistant reply. Added a reply nod.
   Verification: two focused real-dashboard component regressions passed,
   including unlock-before-chat, one notice, explicit full playback and draft
   preservation. User reports the prototype works; automated browser QA remains
   distinct from these jsdom fixtures.
2. **Cancellation and error recovery.** Stop/navigation now suppress stale
   responses before decoding; switching conversations stops speech. A browser
   that remains suspended reports a useful error. Verification: four audio tests
   passed. The first run exposed a test fixture that waited only one microtask;
   changed it to wait until the asynchronous request exists, then verified stop
   prevents decoding after disposal.
3. **Remember speech choices.** Per-tab preferences survive Chat/Avatar switches
   and refresh; invalid storage falls back to private-summary mode. Quiet mode
   stays quiet, and historical replies are available only for explicit playback.
   Verification: five audio/preference tests and the focused quiet-navigation UI
   regression passed. Nothing autoplays merely because a page is restored.
4. **Readable long answers.** Explicit full playback cleans Markdown presentation,
   substitutes a chat reference for fenced code/URLs, and splits up to 8,000
   spoken characters into bounded clips. The original transcript is unchanged.
   Progress shows the part being read; Stop cancels the rest of the queue.
   Verification: seven audio/text tests passed, including ordered multi-clip
   playback and no third request after cancelling the second clip. Default
   summary mode still emits only the fixed notice.
5. **Playback controls.** Added remembered volume and 0.75–1.25× speech speed.
   Speed changes native synthesis rate rather than changing recorded voice pitch;
   volume adjusts the local Web Audio gain immediately. The server validates rate
   and passes only numeric arguments to say. Verification: eleven audio/backend
   tests and the Send-to-speech UI regression passed; gain changes and rate bounds
   are covered. Runtime API reload is reserved for final acceptance.
6. **Speech and reply motion.** Mouth attack/release now uses elapsed time rather
   than per-frame smoothing, with a noise floor and closed-mouth settling.
   Reply nods fade out after 2.4 seconds. Reduced-motion settings are observed live.
   Verification: both motion tests passed, comparing 30/120 Hz envelopes, silence,
   invalid input, nod duration and reduced motion. Both GLB rig transforms were
   inspected; no photorealism or phoneme alignment is claimed.
7. **Accessible controls and compact settings.** Arrow keys rotate, Shift-arrows
   pan, +/- zoom and Home resets the focused viewport. Escape stops voice.
   Camera hit areas and visible focus improve keyboard/touch operation. Speed
   and volume move into a compact disclosure; errors appear above the avatar.
   Verification: three motion/key tests and the real-dashboard Escape playback
   regression passed. CSS was checked for narrow-width overflow guards; browser
   viewport visual acceptance remains pending.
8. **Rendering lifecycle and recovery.** Offscreen/hidden/inactive avatars stop
   their animation loop. Context loss exposes Retry 3D while Chat and speech stay
   usable. Retrying, switching assets and unmounting release models, controls,
   observers and WebGL contexts. Verification: lifecycle component test passed
   with real Three scene/control objects and a fixture renderer; exercised
   offscreen resume, inactive resume, context loss, retry and final cleanup.
9. **Own-voice feasibility and recording plan.** Checked primary model cards and
   implementation docs. Recommend Qwen3-TTS Base via MLX Audio for a local trial;
   compare Chatterbox, distinguish F5-TTS code/weight licensing. Documented a
   private recording location, reference transcript, adapter design and measured
   acceptance criteria. Verification: official Qwen and MLX cards identify
   Apache-2.0 and reference cloning; Chatterbox weights MIT; F5 pretrained weights
   CC-BY-NC. No model installed, voice uploaded, training or performance claimed.
10. **Integrated acceptance and runtime refresh.** Production build passed.
    The first full run had 357/359 passing: the known Mac loopback failure and a
    real CLI-resolution regression. Pinning Node had shadowed the fixture/owner
    CLI with a sibling executable. Resolve OpenClaw on the original PATH first,
    then pin Node for that executable. The six affected runtime/security tests
    passed; the repeated full suite now has **358 passed, one known failure**
    (`interface-access.test.js`, EADDRNOTAVAIL at 127.0.0.2). No test suppressed.
    Refreshed the local HUD API after no HUD session update for over 11 minutes;
    current owner CML request was already answered. Real API probes confirmed
    local voice available and 15 discovered model choices. Native WAV synthesis
    at 0.8×/1.2× returned 200 in 1.24/1.14 seconds, with audio duration 3.34/2.61
    seconds; invalid speed returned 400. These probes generated audio files,
    not a claim that the browser speaker output was heard. Spec checker and
    whitespace checks passed. No additional operational or frontier prompt was
    sent during the polish probes. Final visual/audio QA remains manual because
    this session's browser tool previously rejected localhost access.

Completed: 10/10 explicit passes. Current branch remains 144-tavus-netclaw-pal.
No Git commit/push, provider upload, model download or voice training. The owner
reported the initial local avatar/audio works; final polish is available after
refresh. The full-suite platform failure remains disclosed, not called a pass.
