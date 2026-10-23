# Spec 144 closeout verification — 2026-10-09

## Delivered behavior

John and Lobster share the existing authenticated Chat, model selection, history,
conversation and approval path. Avatar is the fourth interface beside Chat,
Canvas and OpenClaw. Original generated GLBs and previews ship with source;
Blender is only needed to rebuild them. Original portrait files stay local and
are not included in this PR. The unrelated MSP architecture document is excluded.

macOS system speech uses authenticated, bounded subprocess calls and private
transient files. Automatic speech is a fixed notice by default; reading answer
content requires explicit playback or opt-in. Stop/navigation/visibility and
conversation/character changes cancel playback. There is no hosted fallback.
Other systems retain text and rendering but report speech unavailable.

The installed OpenClaw 2026.7.1-2 compatibility repairs use supported model/history
RPC fields and loopback credentials in the child environment. Runtime setup is
not performed by installing the source update.

## Current checks

| Check | Result |
|---|---|
| Full HUD unit suite | 358 passed, 1 failed on this macOS host |
| Known failure | Existing interface-access.test.js cannot bind 127.0.0.2: EADDRNOTAVAIL; unchanged fixture, no host alias or skipped test |
| Production build | PASS; existing large-chunk advisory |
| Python Pal boundary/setup | 4 passed |
| Spec artifacts | PASS, 129 specs with four declared legacy exceptions |
| Declaration reconciliation | PASS: catalog, dependencies, docs, Meraki IDs, packages, portability |
| Initial live avatar/audio | Owner confirmed working in the preceding session |
| Local real API evidence | Earlier authenticated chat, model/history and speech-rate checks recorded in implementation-evidence.md and ralph-polish.md |
| Final browser polish | Not independently accepted: previous browser automation policy blocked localhost; fixture/render lifecycle tests are not live speaker/viewport evidence |

CI for the submitted commit must pass before merge. No administrator bypass is
permitted. Final CI/merge identifiers are recorded in the session log.

## Explicitly deferred

Hosted Tavus remains disabled by default and experimental. No live PAL, tool,
conversation, image upload, training or paid upgrade was performed. Its tests
verify local fixtures, not account entitlements or provider billing guarantees.
Tasks T008/T009/T011b/T020 and the hosted part of T019b need their own acceptance.
T027–T030/T038 cover future account/profile/Border/member and voice-clone work.
T034b records the final browser gap. These unchecked tasks are not represented
as completed by closing the narrowed local feature.

## Coherence and audit

Updated HUD, dependency lock, installer/catalog, README, SOUL, TOOLS, skill and
configuration examples. The optional pal_query MCP facade is intentionally
HUD-invoked and absent from the main MCP registry to prevent recursive dispatch.
No new live device observations are claimed: startup pyATS inventory failed on
the existing connections.defaults.arguments testbed entry. MemPalace's configured
server script is absent; local memory and GAIT retain the session record.

## Upgrade and rollback

Update source and run npm ci/build for the HUD. Existing Chat/Canvas and saved
conversations remain. Optional hosted setup is manual and disabled by default.
To stop using Avatar, select Chat; no provider resource needs cleanup for local
use. Revert the source release and restore matching npm dependencies to roll back
code. Do not erase provider ledgers or private gateway backups. Hosted users must
end/reconcile any provider call before disabling that experimental path.

## PR CI integration follow-up

PR #286's first Linux run passed HUD and 29 other checks, but three contract
suites exposed stale fixtures after integrating current main's spec 049 installer
changes. The new Python-version prerequisite ran before fake pip failures; tests
must answer that probe successfully to exercise their intended pip-error branch.
The Zabbix source assertion also needs to recognize the new component helper,
while checking it delegates to supported isolated creation and validates Python.
Updated these test fixtures without weakening runtime checks or skipping tests.
