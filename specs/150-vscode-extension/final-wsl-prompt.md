# Final WSL confirmation — unpublished Spec150 on main

**Completed 2026-10-11:** the exact artifact passed the targeted Windows/WSL
confirmation. See [final evidence](evidence/wsl-final.md). The instructions below
are retained as the executed handoff; they are not a request to repeat validation.
Publication remains held and Spec151 has not started.

This is the current handoff. Earlier WSL/Mac prompts are historical. Implementation
T001–T022 is complete for the documented client scope; this checks the final small
RAG correction on the exact package. **Do not publish.** Advanced enhancements and
aesthetics belong to a separate Spec151, which has not started.

## Copyable prompt

```text
Finish the final NetClaw Spec150 Windows/WSL confirmation from main. The owner
authorizes this validation, evidence/fixes within the existing extension scope,
commit/push/PR/merge after applicable checks, and safe cleanup back to main.
DO NOT publish to Marketplace, create a GitHub release/release-version tag, use
publisher credentials or publish the blog. Do not start Spec151 or expand scope.

Fetch origin/main and tag spec150-main-handoff-20261011. Require that tag and
e34db232b775ef0308f5e47d309c3e32609be77f are ancestors of origin/main. Inspect any
later main changes affecting the extension before claiming this artifact matches
current source. Preserve all existing checkout edits, credentials, services and
private editor data. Use a new isolated worktree/branch from origin/main if needed;
do not reset or clean the old WSL checkout. The old Spec150 branches were merged
or replaced with archive tags; do not resurrect the expanded backend experiment.

Read AGENTS.md, SOUL.md, USER.md, TOOLS.md, daily memory and the constitution.
Start AND CHECK OUT a new GAIT session branch; record work and end with gait_log.
Read specs/150-vscode-extension/{spec.md,plan.md,tasks.md,closure.md},
contracts/existing-interfaces.md, evidence/main-consolidation.md,
evidence/{wsl-followup.md,wsl-followup-checks.json,mac-final.md,mac-final-checks.json}
and this final-wsl-prompt.md. Respect current instructions over historical prompts.

Use this exact committed NetClaw.netclaw@0.1.0 artifact:
specs/150-vscode-extension/artifacts/netclaw-0.1.0-mac-final.vsix
SHA256 b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8
2349725 bytes; packaged source c2a145946d331f7bc3d8c528c768d06998bb19d4.
Verify sha256sum and installed extension payload, excluding only editor-generated
package metadata. Do not rebuild just to resume or substitute an older VSIX.

The prior f75b73bd package already passed real Windows/WSL OpenClaw workflows,
Copilot/Claude Code/Codex and installed lifecycle. Preserve the recorded Copilot
permission deviation and subsequent Default-permissions recheck. Only README,
changelog, RAG frontend and the extension bundle changed in the final package;
the assistant adapter and other assets are byte-identical. Full assistant/provider
and lifecycle matrices need not be repeated without a new relevant change/failure.

1. Observe current Windows editor, WSL host, compatible HUD identity/readiness
   and RAG availability. Reuse the previously isolated editor/storage arrangement
   only after checking its actual ownership and current state. Install the exact
   candidate in that isolated WSL extension host and verify its files. Preserve the
   owner's normal installed extension, Windows work and global client settings.
   Use normal editor update/consent UI; never bypass locks or weaken permissions.
   Preserve the previously approved HUD Node repair, isolated RAG Python/runtime
   dispatcher and rollback backups: they are active service dependencies. No new
   backend repair, service restart, runtime upgrade or credential change is covered
   by this prompt. If an actual prerequisite has regressed, report its evidence
   before requesting only the concrete repair needed.

2. In the real Windows desktop VS Code connected to WSL, exercise RAG against the
   existing compatible HUD. Search the retained harmless fixture
   spec150-wsl-rag-20261011-b7a3d92e.md (doc_0e84d3b40932) if still present; otherwise
   use an explicitly reviewed harmless fixture, never assume it exists. Confirm
   inventory, result and source/citation. Click Refresh and immediately try Search:
   while busy, buttons/inputs/selects must be disabled; after completion they must
   recover and one explicit Search must complete. No request may silently vanish,
   queue or automatically replay. Hide/reveal the RAG view during a pending read;
   confirm the busy state and controls recover, then perform one explicit search.
   Cancel the native upload/file/category/review flow and verify controls recover
   without an upload. Do not delete/reindex the corpus or resend provider work.

3. Use an isolated unchanged-HUD fixture for deterministic delayed/error reads,
   cancellation and disconnect while pending; do not break the owner's live HUD.
   Confirm errors release controls and a late completion after invalidation cannot
   re-enable a disconnected view. Observe bounded request counts to rule out
   implicit retry. The DOM regression in test/rag-view.test.mjs is supporting
   evidence, not a substitute for the actual WSL editor. Use the prior Windows/WSL
   qualification method; the Mac-specific editor runner is not a Windows runner.
   Keep credentials, raw private responses and workspace data out of committed
   logs/screenshots. No new provider request or device configuration is required.

4. If an actual extension defect is found, fix only that reproduced client defect,
   add a meaningful regression, commit source before producing a replacement VSIX,
   retain original artifacts and qualify changed behavior on the required hosts.
   If changed product bytes require Mac qualification unavailable here, report it
   honestly; do not mark final acceptance complete. Do not add backend services,
   new NCFED behavior, testbed management or Spec151 enhancements.

5. Record exact editor/WSL/HUD versions, installed digest, each observation and
   preservation/cleanup result in evidence/wsl-final.md and a sanitized structured
   report. On success, update closure.md, tasks.md and artifacts/mac-final-package.json
   to state that the exact final RAG delta is qualified on WSL; preserve previous
   evidence and limitations. Correct the pending-check text in README.md and
   docs/releases/1.9.0.md. T023 stays unchecked and HELD BY OWNER. Do not rebuild
   unchanged package inputs or call all platforms/Hermes qualified.

Commit and push the evidence/fix branch. Open a focused Spec150 PR, wait for all
applicable checks and merge without admin bypass or force-push. Remove only your
merged completion branch, return the clean working checkout to updated main and
verify local HEAD equals origin/main. Preserve other active/private work. Record
daily memory and full GAIT log. Report the final commit/PR, exact VSIX SHA256 and
scope, that nothing was published, and whether Spec150 is ready for Spec151 with
no further Mac handoff required. Do not invent a passed check to avoid a handoff.
```

## Completion boundary

Successful execution closes the final exact-package WSL delta. It does not execute
T023, undo the publication hold, prove live Hermes/other hosts, or authorize new
features. Existing records remain valid only for their stated artifacts and scope.
