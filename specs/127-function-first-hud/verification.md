# Verification — specification start

Date: 2026-09-27. Baseline: `aeb0fcc` on main; working branch `127-function-first-hud`.

| Check | Result |
|---|---|
| Repository spec-artifact checker | PASS: 114 specs checked, 4 enumerated legacy exceptions |
| Initial package local Markdown file links | PASS: 11 checked, zero missing targets |
| Canvas `App.jsx`, `session-gate.js`, `canvas.html`, Vite entry configuration | Byte-for-byte identical to Git HEAD |
| Runtime modifications | None |
| Runtime/browser/host acceptance | Not run for this documentation-only spec start; all implementation tasks pending |
| pyATS startup inventory | Attempted; MCP invocation timed out after 45 seconds, no verified inventory or device-state conclusion |
| MemPalace | No exposed tool and no configured process runtime; daily file memory used |
| GAIT | Session branch created/checked out and root verified; discovery record `6c0b5012`; final summary/log follows |

The baseline canvas SHA-256 is `b3d69e0e404fd174fe5656c7525b98449b2c0b2d56a2f83f6298eed10e10ed32`. The session gate SHA-256 is `4c840c8521feba54dde3f2f568952797ed268653aa10972beccd76e73fd5647e`.

Specification consistency review is in [analysis.md](analysis.md). The task-binding integration spike remains explicit; source inspection does not constitute proof of a working authenticated bridge. No network configuration, paid inference, ticket, external message, Git push or deployment occurred.

## Implementation verification — 2026-09-28

User ratified the spec and authorized implementation, with confirmation before push.
The earlier table is the historical documentation baseline, not the current code state.

| Check | Result |
|---|---|
| Initial HUD baseline | 228 passed; 2 failed with local-listener EPERM before changes |
| Current complete HUD test invocation | 254 passed of 256; the same 2 listener tests remain EPERM-blocked |
| Jev core/environment/adoption/Border/installer/read-only MCP | 81 passed; no paid inference |
| Production Vite build | PASS, all four entries: dashboard, canvas, classic, assessment |
| Existing build warning | Three.js/OrbitControls chunk exceeds 500 kB; dashboard loads its scene on demand |
| Canvas persistence | Production serializer/loader round trip preserves old synthetic graph, branches, synthesis, tabs, attachment content and layout; DB name/version/stores unchanged |
| Canvas session behavior | Gate/save/delete regressions pass; relate-to-origin regression added and passes |
| Jev authorization | Cookie/task/assessment isolation, forged/foreign references, expiry/revocation, lineage, missing baseline and no reassignment pass direct route/model tests |
| Actual MCP reader | Real stdio test reads the fixed task and rejects evaluation; no additional ledger rows |
| DOM journeys | Production bundle renders; Basic/Advanced, all destinations, member inspector and typed comparison pass in jsdom |
| Spec artifacts | PASS: 114 checked, 4 pre-existing enumerated exceptions |
| Catalogue coherence | PASS: zero unexplained gaps; no new integration or tool count |
| Browser / WebGL / responsive visual QA | BLOCKED: no connected browser provider; native Chrome use rejected by automatic approval review |
| Live HTTP / WS / dev preview | BLOCKED: sandbox refuses local listeners (`listen EPERM`) |
| Real gateway task envelope | PENDING; direct Jev tool results supported, CLI-only wrappers remain unbound |
| Native Linux / Windows-browser→WSL / real mobile | PENDING; not claimed from macOS unit/DOM fixtures |
| User review / push | Portable synthetic preview generated; no user confirmation or push yet |

The portable preview is `/tmp/netclaw-hud127-preview.html`. Regenerate with
`node ui/netclaw-visual/src/dashboard/preview-build.mjs`. It deliberately labels
all data synthetic and does not substitute a fake canvas for Adam's actual app.

Source review caught and repaired a relate-to-origin return-shape regression before
handoff. A failed transcript baseline now denies linkage; existing assessment IDs
cannot be rebound to a later message. Scoped canvas content no longer enters global
chat/history broadcasts. Exact installed OpenClaw session-header support was inspected
locally; deployed runtime proof remains an acceptance gate.

GAIT implementation branch: `spec127-implementation-2026-09-28`, intermediate record
`f0c31ae1`; final record/log follows. pyATS startup invocation was attempted and timed
out; no device inventory or health conclusion is claimed. MemPalace is unavailable.
No device change, external communication, ticket, paid inference, deployment or Git push.

## RAG / Configuration follow-up — 2026-09-28

Current complete HUD suite: **264 total, 262 pass, 2 fail**, the same two baseline
`listen EPERM` failures (rag-upload and server-access). New targeted production DOM
and handler checks: **11/11 pass**. Build all four entries passes; server syntax and
diff whitespace checks pass. Preview regenerated at `/tmp/netclaw-hud127-preview.html`.

The actual production dashboard mounts `/canvas.html?embedded=1` once, retains the
same iframe DOM object across Overview/Canvas and Basic/Advanced, and retains the
`/canvas.html` full-tab link. Labels now say Canvas. Existing Canvas storage/session
regressions continue passing. This is DOM/source/build evidence, not a completed
interactive browser journey.

RAG tests cover actual multipart form submission with a mocked HTTP response,
202 pending status, retrieval request/collection/citation handoff and visible service
failures. Server tests prove argument bounds, fixed read-only tool dispatch,
concurrency limits and safe errors. No real document was uploaded or indexed in the
operator's corpus. Configuration tests prove no credential values/fragments escape
the projection. No .env edits were made. Browser/live RAG, gateway and host acceptance
remain required; the earlier restrictions still apply. Startup pyATS bridge failed
with PermissionError; no current device state asserted. Nothing pushed.


## Introspection / Tokenomics / Documentation / Logs / Security follow-up

Current HUD suite: **280 total, 278 pass, 2 fail**, unchanged listener-EPERM
failures in existing rag-upload/server-access integration tests. Focused dashboard,
usage/log/docs/security suite: **30 pass**. Federation inventory/boundary/risk/member
and posture suite: **42 pass**. Four-entry build, syntax, whitespace, spec-artifact
(114 specs, 4 legacy exceptions) and catalogue-coverage checks pass. Twelve local
guide links and OpenAPI path/parameter coherence checks pass. Portable preview
executes in the DOM harness with no errors; no browser visual QA claim.

Generated references: **156 CLI/source entries** (including npm/Node launchers),
**110 MCP registrations**, **296 source tool signatures/schemas**, **41 HUD HTTP
operations**, **305 documents**. No CLI entry point executed during generation.
External/version-specific CLIs and dynamic MCP schemas remain explicitly dependent
on installed help/tools-list. Legacy HTTP payload schemas are not fully typed;
the OpenAPI artifact is a source-derived route inventory with that limitation.

Tested: exact peer/member inventory shape, primary/fallback model displays,
authenticated-channel member binding, scoped HOME and agent/model overrides, no
empty-scope fallback to Border registry, credential-free projections, usage missing
coverage/cost/cache separation, bounded fixed-source log reads, symlink rejection,
credential-pattern redaction, logs-to-Canvas handoff, document allowlists and links,
mode/probe distinction, stale/incomplete posture refusal, fixed OpenShell status
arguments, service-specific Security log navigation, and preserved Canvas iframe.

Read Sean Mahoney's README-linked community guide to create an attributed link panel;
its July 2026 counts are not substituted for this checkout. Removed the old HUD SSH
migration callout from README; loopback/Host/Origin protections remain unchanged.
Corrected .env.example's old OpenShell wording for current systemd member confinement.

No live member reconnect, production security-mode switch, configuration write,
service restart, sandbox creation, real log inspection, live RAG ingestion or paid
inference performed. Browsers remain blocked by the earlier approval rejection;
local sockets remain prohibited by the sandbox. Live gateway/RAG/logs/usage/security
and per-host/mobile acceptance remains pending. No Git push or publication.


## Authorized release / scoped upgrade helper

User subsequently authorized all release steps. Added `scripts/upgrade-hud.sh`
(check/apply/optional lockfile install/alternate checkout), with **2 tests passing**
and actual --check plus --apply/four-entry build passing. Helper changes no runtime
configuration/services/browser storage. Generated CLI reference now includes 157
entries. The general upgrade utility remains planned; spec128 scope awaits the
user's next ideas.

Release blocked: staging failed because .git/index.lock cannot be created under
this session's filesystem permissions; gh could not connect to api.github.com.
No Git commit/push/PR/merge/branch deletion/main checkout occurred. Existing feature
work remains local. A complete PR description and spec128 handoff are prepared.
