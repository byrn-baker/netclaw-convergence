# Final Windows/WSL confirmation — passed, unpublished

Observed 2026-10-11. The owner authorized the exact-package confirmation,
evidence PR/merge and safe cleanup, with publication held and no Spec151 work.
This completes the final Spec150 validation for the documented existing OpenClaw
client scope. No product bytes changed and no further Mac handoff is required.
T023 remains unchecked and **HELD BY OWNER**.

## Provenance and actual host

Started from `origin/main` at `8d4c5baff100b37feec39f35c87682bc6f18fca8`
in a new isolated worktree. Both `spec150-main-handoff-20261011` and
`e34db232b775ef0308f5e47d309c3e32609be77f` were verified ancestors. Later changes
relative to packaged source affect only the excluded editor runner/tests; no
packaged product input changed.

- Artifact: `NetClaw.netclaw@0.1.0`,
  [netclaw-0.1.0-mac-final.vsix](../artifacts/netclaw-0.1.0-mac-final.vsix).
- Source: `c2a145946d331f7bc3d8c528c768d06998bb19d4`.
- SHA256: `b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8`.
- Size: 2,349,725 bytes; 25 ZIP entries. All 23 extension payload files matched
  the installed copy, excluding only editor-added `package.json` metadata.
- Windows 10.0.26300.9550; desktop VS Code 1.141.0,
  commit `2a59476c9bfcb90b3ddc372c36762471b7dfad1c`; Remote WSL 0.104.3.
- WSL 3.0.1.0; Ubuntu 26.04 LTS; kernel
  `6.18.40.1-microsoft-standard-WSL2`. The distribution display name remains
  `Ubuntu-22.04`. The actual extension host reported `linux` / `wsl`, with both
  installed extension and storage in the previously isolated remote directory.
- Existing compatible OpenClaw HUD: source 1.9.0 at the starting main commit,
  supported Node 24.19.0, isolated RAG Python 3.12.10. Its unchanged readiness was
  `ready: true, executionVerified: false`; this run makes no new provider claim.

The exact VSIX was installed through the normal remote extension CLI. The real
Windows editor used the prior private user-data/extension arrangement after its
ownership and inactivity were checked. A development observer drove normal
extension commands and native UI; the product was the installed VSIX, not a source
development load. No consent APIs were mocked or permissions weakened. The
Mac-specific editor runner was not used as a Windows runner.

Only packaged README, changelog, RAG frontend and extension bundle differ from the
preceding WSL-qualified artifact. Assistant and other resource bytes match. The
previous complete WSL assistant/provider/lifecycle matrix remains evidence for
its stated artifact/scope; this targeted delta does not rerun unrelated work.

## Actual editor results

| Check | Observed result |
| --- | --- |
| Live inventory and retrieval | Retained harmless fixture `spec150-wsl-rag-20261011-b7a3d92e.md`, `doc_0e84d3b40932`, was ready with one chunk. Search rendered its title, source citation and fictional Apricot Observatory passage, including Thursday 14:20 UTC and `APRICOT_B7A3D92E`. |
| Refresh immediately followed by Search | All buttons, inputs and selects disabled synchronously. The overlapping click sent no search. After refresh completed, controls recovered and one explicit search returned cited results. |
| Live hide/reveal during pending read | Returning to RAG showed “Waiting for the knowledge operation…” with every control disabled. Completion restored controls. One explicit subsequent search returned the retained fixture citation. |
| Deterministic pending hide/reveal | An isolated unchanged HUD behind a private delay proxy returned exactly one documents read and one stats read for the refresh, despite hide/reveal and an attempted overlapping search. No queued search or replay appeared. |
| Explicit search after completion | Exactly one search request returned HTTP 200 and the honest empty-corpus response from the disposable fixture. Live retrieval is established separately above. |
| Delayed errors | Injected HTTP 503 on documents released controls; a separately explicit search returned one HTTP 503 and also released controls. No automatic retry. |
| Native cancellation | File selection, document category and final upload review were each cancelled normally. Controls recovered after each stage; the fixture counted zero HTTP requests and zero uploads across these checks. |
| Disconnect during pending read | All controls stayed disabled after disconnect and through the delayed HTTP 200 completion. Exactly one documents request, no subsequent stats/search and no replay. The native abort message replaced the transient disconnect notice; it did not re-enable controls. |

Deterministic faults used a read-only timing/error proxy in front of a separate
unchanged HUD, synthetic runtime configuration and an empty disposable RAG corpus.
They are explicitly fixture results, not failures injected into the owner HUD.
The fixture refused writes/provider routes and counted zero provider requests.
The owner's corpus retained two documents / 1,056 chunks. Query telemetry moved
from 22 to 24 for the two explicit live searches. The cancelled test filename
was absent. No upload, deletion, reindex, provider request or device configuration
was submitted by this run.

Supporting DOM regression passed: one test, zero failures/skips. Spec artifact
checks passed for 134 specs with four legacy exceptions; release metadata and its
six tests passed; all six MCP declaration surfaces passed. The exact package was
not rebuilt. The existing Mac 20-case/source/editor evidence remains unchanged.
Applicable PR checks are required before merge; final merge/cleanup identifiers
are recorded in GAIT and the session return.

## Preservation, cleanup and observer limitations

All 15 protected file observations matched after validation. The owner extension
payload and checkout status were unchanged through validation. HUD, gateway and
core federation process identities stayed unchanged; scheduled DDNS and the
already-restarting Zoom RTMS service varied independently. No service was restarted
or repaired. The active Node/RAG repairs, dispatcher and rollback material remain.

Two temporary fixture connection profiles were removed, the original validation
profile retained, and the validation editor closed normally. Its debug listener
closed. The conditional editor isolation hook was restored to its original
absence. The fixture stopped gracefully; its process was verified absent. Raw
responses, owner screenshots and private paths remain outside Git.

Two observer issues were corrected without product edits: remote file selection
needed to await directory population, and disconnect assertions needed to check
the persistent disabled state rather than a transient notice. The corrected
actual editor checks passed. These are not hidden extension fixes or fabricated
uninterrupted automation passes.

The owner subsequently requested removal of the test installation and cleanup of
the thousands of untracked files. Normal extension commands uninstalled NetClaw
from the owner WSL host and private WSL/Windows validation hosts. Two WSL CLI
inventories and three Windows extension registries confirmed absence. Saved
private extension state was retained. The owner confirmed saving work and reloading
VS Code to unload any already-running copy.

The 6,681 untracked files were 6,680 files in the retained HUD dependency rollback
tree and one testbed backup. Both backups were moved to an owner-private cache
outside the checkout with complete content comparison; the private rollback plan
now points to the relocated dependency tree. No active runtime dependency moved.
The owner checkout has zero untracked files. Its pre-existing tracked testbed edit
remains intact because reverting it would change active installation configuration.
The isolated completion checkout returns to clean updated main after merge.

Prior limitations remain: the Copilot permission deviation and Default permissions
recheck; the earlier Claude configuration comparison limit; the Mac 1.102 CLI
inventory anomaly; and no broader live Hermes, reboot, second distro/Remote SSH,
device/peer operations or physical mobile acceptance. No assistant permission
settings were changed in this run.

GAIT branch `spec150-final-wsl-20261011` was created, checked out and verified.
Startup `14efe219` and RAG checkpoint `d2ba14d8` precede final cleanup/merge records.
Daily memory and the full session-end GAIT log are retained locally. MemPalace and
WordPress tools were unavailable; the milestone draft was updated locally and
remains unpublished. No Marketplace action, publisher credential use, public
release, release-version tag, blog publication or Spec151 implementation occurred.

Portable details: [structured report](wsl-final-checks.json).
