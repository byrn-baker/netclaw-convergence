# Final Mac qualification — implementation complete, publication held

Owner direction on 2026-10-11: complete Spec150 implementation and functionality;
**do not publish**. Advanced enhancements/aesthetics belong to a future Spec151.

## Returned source review

Fetched `af66075411b6ccfbc52adfad9d278ca70985bd87` in a new isolated checkout.
The WSL-qualified candidate is retained unchanged as `netclaw-0.1.0-wsl-fixes.vsix`,
SHA-256 `f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`.
It contains 25 ZIP entries / 2,349,236 bytes. Mobile logo is byte-identical to the
original asset; assistant payload is byte-identical to the original candidate.

The WSL fixes persist per-view message sequences and correct Windows-local WSL
guidance. They retain host identity/replay/trust checks. WSL evidence is accepted
for its documented existing OpenClaw scope, including the reported Copilot
permission deviation and subsequent Default-permissions recheck. No uninterrupted
default-permission or broader Hermes/SSH/reboot claim is made.

Mac source check/build: passed; 18 default tests passed and the opt-in RAG test was
skipped. The opt-in test then passed separately using actual unchanged HUD/RAG MCP
and cached local embeddings, with a disposable corpus and zero provider requests.

## Additional confirmed RAG defect

Exact installed returned candidate on macOS / VS Code 1.141: RAG search submitted
immediately after Refresh collections was silently discarded by the host's busy
guard. The frontend still displayed search progress and no result arrived.
The failure was reproduced in the actual editor, not inferred only from source.
Other checks reached successful activation, identity/MCP binding, themes, Chat,
tab restore, actual RAG retrieval and Canvas restore before this failure.

The extension-only fix disables controls synchronously while a knowledge operation
or native review is active, reports busy state across webview recreation, and
restores controls on completion/cancellation/error. Disconnection remains final
even if a late completion arrives. Host overlap refusal is explicit. No automatic
queue/retry, backend change or new authority is introduced.

Focused DOM regression covers initial loading, refresh/search overlap, explicit
next search, failure, cancelled review and late completion after invalidation.
Source check/build and 19 default tests pass (one optional RAG fixture skipped).
Development-editor regression passed on 1.141, including restored RAG refresh/search
and cited results, Canvas save/open after reveal and Chat/Overview restore.

The test runner now supports installing an exact VSIX into a private profile and
checks every installed payload byte against it (only editor-added package metadata
is excluded). It can explicitly target an already-running HUD for a harmless real
provider check. These runner changes are excluded from the VSIX. Packaging and
exact new-artifact checks follow; do not treat source tests as package acceptance.

The previous WSL evidence remains evidence for its recorded artifact; it does not
claim execution of this Mac-discovered RAG delta on WSL. Any later public release
must review the exact final artifact's remaining host qualification.

## Final artifact and completed Mac checks

Clean package source: `c2a145946d331f7bc3d8c528c768d06998bb19d4`.
Artifact: `artifacts/netclaw-0.1.0-mac-final.vsix`, 2,349,725 bytes / 25 ZIP entries.
SHA-256: `b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8`.
Only four entries differ from the WSL-qualified package: README, changelog,
`resources/rag.js` and `dist/extension.cjs`. The assistant, Canvas, Avatar,
messaging helper and other resource payloads remain byte-identical.

- **VS Code 1.102, exact installed VSIX:** installed payload verified against ZIP;
  activation/profile/identity refusal, actual MCP definition process and cached
  disable, dark/light/high-contrast rendering, owned Chat, Canvas save/open and
  branching, local Avatar, disconnect invalidation and all four views' hide/reveal
  regression passed. Actual local RAG indexed/retrieved a disposable document and
  rendered its citation. Refresh followed by Search waits for enabled controls
  and returns the result; no silent dropped search. Gateway is explicitly synthetic.
- **VS Code 1.141, exact installed VSIX in a normal isolated window:** native
  selected-text review and selection, real configured OpenClaw provider answer,
  saved conversation restore after tab changes, Canvas save/open, Avatar and
  disconnect invalidation passed. The fictional note's Thursday/14:20 UTC details
  appeared in the assistant's answer. No content was treated as change approval.
- **VS Code 1.141 installed lifecycle:** synthetic 0.0.0 → exact 0.1.0 upgrade,
  disable/re-enable and uninstall all passed; saved profile and fixture backend
  configuration remained unchanged. Uninstalled extension absent from inventory.
- **VS Code 1.102 lifecycle:** all four editor stages and the uninstall command
  passed. Its first post-uninstall inventory command aborted inside the editor's
  embedded V8 CLI. A subsequent normal inventory exited 0 and confirmed absence.
  Record this upstream-editor anomaly; do not claim a clean uninterrupted pass.
- Type/build/default suite and separate optional RAG checks cover all 20 test cases
  across the two runs. Later observer-only corrections do not enter the VSIX.

Portable evidence: [check summary](mac-final-checks.json),
[minimum editor](mac-final-editor-1.102.json),
[live editor](mac-final-live-editor-1.141.json),
[current lifecycle](mac-final-lifecycle-1.141.json). Fixture-only screenshots are
in `screenshots/mac-final/`. Live screenshots/logs remain private; the actual Chat
answer and Avatar layout were visually inspected.

## Live target and preservation

macOS 26.5.2 arm64; test/build Node 24.19.0. The owner's already-running Mac HUD
on port 3001 returned 404 for `/api/runtime`. It was preserved, not upgraded or
restarted. The real-provider check launched an additional temporary process of
unchanged baseline HUD source on allocated loopback ports, bound to the owner's
existing OpenClaw home, native identity and gateway/provider. RAG corpus, testbed,
terminal-known-host file, editor profile/extensions and observer were isolated.
This is real provider integration, not proof that the original port-3001 service
has the required API. A compatible running HUD remains the documented prerequisite.

Five protected configuration/environment/identity observations were identical
before/after; owner HUD and gateway PID/start times were unchanged. The temporary
HUD and owned editor windows stopped after checks. Native session/history/audit
records from the two harmless conversations remain as ordinary runtime records.
No whole-editor/global-storage byte-preservation claim is made; normal VS Code
bookkeeping can occur. The publication hold was recorded in local user memory.

## Test-harness and provider observations

VS Code deliberately refuses review dialogs under `extensionTestsPath`. The first
live runner attempts stopped at that refusal before sending a provider request.
The corrected runner uses a normal isolated observer window and real VS Code
dialogs; it does not mock the consent API or disable approval policy.

The first submitted fixed-token test prompt was refused by the configured NetClaw
model as an approval-token pattern. That refusal is retained as an actual result;
no policy was weakened or approval manufactured. A separate ordinary reading
question about a fictional note returned the correct day/time. These were two
explicit harmless submissions, not an automatic retry of unknown work.
The test-created unsaved note was discarded through the normal Don't Save dialog;
the reusable observer now handles that exact test cleanup explicitly.

## Completion and held release

T019 is complete for this exact Mac artifact. Implementation tasks T001–T022 are
complete for the documented client scope. T022 preserves the full WSL qualification
of the preceding artifact; **the final RAG busy-state delta is not WSL-qualified**.
Before any future publication, confirm that small delta on the actual WSL host.
There is no claim of live Hermes, WSL reboot, second-distribution/Remote SSH,
external peer/device-change or physical mobile acceptance.

T023 is **held by explicit owner instruction**. No publishing command, publisher
credential use, merge, release or external blog publication occurred. Future
Spec151 covers advanced enhancements/aesthetics and does not authorize release.
