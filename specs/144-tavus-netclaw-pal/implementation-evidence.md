# Implementation evidence — 2026-10-09

Branch: `144-tavus-netclaw-pal`, based on main `95bb17e27a6a2538fcb0168d0b1d0ab5bbe34692`.
Branch 143 remains archived locally. The unrelated `docs/MSP-RISK-ARCHITECTURE.md`
was preserved. Work is uncommitted; no version bump or publication.

## What exists

- HUD Pal destination, local PNG/JPG icon, lazy Daily SDK, private camera-off
  join, explicit start/end, deadline, navigation cleanup, allowance form and
  separate local answers with explicit exact-text speech release.
- Tavus provider adapter and setup CLI; registered app-message tool with the
  current `trigger_type`/`origin` schema and explicit resolution behavior.
- Authenticated routes, operator/conversation binding, revocation rechecks,
  serialized/deduplicated turns, 3 KB event caps, durable atomic allowance
  reservations and ambiguous-creation/termination reconciliation.
- One local MCP tool, `pal_query`, targeting fixed `netclaw-pal` through the
  authenticated loopback gateway. Every dispatch checks an all-tools-denied
  policy and separate reviewed bootstrap workspace. No device reads or writes.
- Optional installer, isolated dependency pins, skill, setup guide and catalog
  coherence (236 skills, 175 integrations, including optional integrations).

## Verification performed

| Check | Result |
|---|---|
| Provider, routes and service tests | 15 passed |
| Pal UI component tests (mock Daily, jsdom) | 3 passed |
| Python boundary and setup tests | 4 passed |
| Complete HUD unit suite | 339 passed, 1 failed |
| Vite production build | Passed; existing large-chunk advisory |
| Spec artifacts | Passed, 129 specs checked |
| Inventory/documentation reconciliation | Passed: 236 skills, 175 integrations |
| Installer catalog coverage | Passed: zero unexplained gaps |
| Dependency pin check | Passed, 72 servers scanned |
| Existing tracked FastMCP compatibility audit | Passed, 35 servers; the new untracked facade is additionally checked through real stdio startup below |
| Skill validator | Passed |
| Installer shell syntax and whitespace diff checks | Passed |
| Local agent preparation dry run | Passed, `applied: false` |
| Isolated facade installation and real stdio call with invalid session | Initialized and returned `invalid-session`; no gateway/model/provider call |

The full HUD suite's one failure is the existing
`src/security/interface-access.test.js` listener on `127.0.0.2`:
macOS returned `EADDRNOTAVAIL`. The file was not changed. Other Host/Origin,
real-server boundary, HTTP ownership and revocation fixtures passed. No alias
or host network change was made to suppress the failure.

Browser security policy rejected `file:///tmp/netclaw-pal-preview.html`.
No alternate browser route was used to bypass that rejection. A synthetic
preview artifact was built, but visual inspection is **not** claimed. UI
verification above uses isolated component fixtures, not a live browser call.

## Coverage and practical limits

Budget tests cover expired/unknown allowance, missing billing attestation,
cross-instance concurrent starts, lowered/exhausted remainder, no calendar
refill, lost create response, failed end, restart and exact-name recovery.
Every 120-second call retains 180 seconds of reservation. The extra minute is
not proof of Tavus billing bounds; those must be checked before live use.

Boundary tests reject another owner, conversation mismatch, unsupported tools,
oversized/multibyte events, conflicting replay, revoked sessions, weakened
tool policy and private bootstrap/memory. Generated sensitive fixture text is
absent from automatic provider events. Explicit speech releases the stored
answer, never caller-supplied replacement text. Audit failure blocks new work
while allowing cleanup. UI tests cover no automatic call/upload, camera off,
speech release, navigation end and cleanup after media join failure.

Installed OpenClaw source was inspected locally: `agents.list`, tool deny
wildcards/deny precedence, fixed agent header routing and unknown-agent
rejection are supported. This replaces the exploration-stage schema
uncertainty, but does not prove that a configured live gateway will accept the
new agent or that model/provider latency fits the call window.

## Not performed / next acceptance

- Runtime agent configuration was not applied and the running gateway was not
  restarted. Only the optional facade's private virtualenv was installed.
- No Tavus PAL, tool, connector, face or conversation was created. No image was
  uploaded. No microphone/camera access, custom training, paid upgrade or video
  usage occurred. Configuration status: key present; PAL/face unset; disabled.
- Exact account balance, stock-face eligibility, PAL/tool creation entitlement,
  provider billing timing and cleanup bounds require account verification.
- Provision a checked eligible stock-face PAL; configure/reload the isolated
  agent; run one synthetic at-most-120-second call; measure tool-result/Echo
  playback, latency, provider usage and confirmed end. These are not unit-test
  guarantees. The separate NetClaw model budget still applies.
- Operational target-scoped read tools, background task polling/resume and live
  network observations remain later work. No unrestricted main-agent fallback.
- Startup pyATS retry reached the configured testbed but rejected
  `connections.defaults.arguments`; no device state is asserted. MemPalace's
  configured server script is missing; observations are recorded locally.

GAIT branch: `spec144-pal-implementation-2026-10-09`. Start record `474c4645`,
implementation milestone `063a76b8`; final trail is retained alongside this file.

## Local Avatar implementation and polish addendum

The preceding sections describe the earlier hosted foundation, not the final
local-first runtime. The local slice now ships original Blender-authored John
and Lobster assets, WebGL rendering/camera controls, and Apple-system WAV speech
through the same Chat conversation and configured frontier model. Avatar is the
fourth Chat interface; it is not a separate sidebar destination. No Tavus account
or video usage is required for this path. John remains stylized and the voice is
not cloned. HEIC-to-PNG conversion is complete in `docs/john.png`.

The authenticated loopback gateway chat endpoint was enabled after a private
config backup, and its service restarted. Installed OpenClaw compatibility
repairs removed unsupported CLI/RPC arguments, pinned the HUD Node interpreter
without shadowing the selected CLI, and restored models, settings and history.
A full UI-shaped request (including default model/effort) returned the expected
synthetic reply in 12.73 seconds; model discovery and owned history reopen passed.
The user then received their own CML answer. That answer reported missing CML
configuration; no successful CML reachability observation is claimed here.

The user requested ten polish iterations and confirmed the initial local avatar
and audio worked. See [the complete pass record](ralph-polish.md) for findings,
fixes and verification. Current build passes; 358/359 HUD tests pass, with only
the existing Mac 127.0.0.2 listener failure. Real speech-rate probes returned valid
WAV and confirmed rate changes affect duration. No local clone was installed or
benchmarked. Primary-source own-voice research recommends Qwen3-TTS Base via MLX
Audio for the next measured experiment with John's reference recording.

The source/runtime work is on the existing spec branch, uncommitted. API runs on
3001 and Vite on 3000. Automation could not inspect the live browser due to
ERR_BLOCKED_BY_CLIENT; final viewport/speaker acceptance is still manual. No
Tavus resources, paid upgrade, avatar upload, model download, voice training,
network-device change or external communication occurred in the polish work.
