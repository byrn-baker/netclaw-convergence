# Spec150 implementation closure — unpublished

Owner direction: finish implementation/features/functionality; **do not publish**.
Advanced enhancements and aesthetics belong to a future Spec151.

Later owner direction, 2026-10-11: push the completed work, reconcile branches and
PRs, merge to `main`, and leave one final WSL prompt before Spec151. This authorizes
source consolidation and supersedes the earlier merge hold only. Marketplace,
GitHub release and blog publication remain prohibited. See
[consolidation record](evidence/main-consolidation.md) and
[current WSL prompt](final-wsl-prompt.md).

## Implemented baseline

T001–T022 implementation work is complete for the retained client scope:
host-local identity-bound profiles; 22 domain observation views; owned Chat with
explicit context/history; Canvas and local Avatar; integrated RAG retrieval,
citations and reviewed uploads; supported settings reviews and service-command
staging; existing Intent/peer workflows; opt-in official-SDK assistant adapter.
The extension manages an existing compatible NetClaw. Backend execution, NCFED,
approval and audit authority remain in NetClaw. No base source change is included.
The [capability matrix](evidence/capabilities.md) defines supported behavior and
runtime-specific limits; this is not complete parity with every backend operation.

All three defects found during qualification are corrected: hidden-tab message
sequences, Windows-local WSL guidance, and RAG overlapping operation controls.
No further reproduced product defect remains open in this work.

## Exact unpublished build

- Package: `NetClaw.netclaw@0.1.0`
- Source: `c2a145946d331f7bc3d8c528c768d06998bb19d4`
- File: [netclaw-0.1.0-mac-final.vsix](artifacts/netclaw-0.1.0-mac-final.vsix)
- SHA-256: `b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8`
- Size: 2,349,725 bytes; 25 ZIP entries; mobile logo unchanged.

Build/source checks and all 20 test cases passed across the default and opt-in RAG
runs. Exact installed Mac checks cover VS Code 1.102 and 1.141, actual RAG/local
embeddings, a real configured OpenClaw provider with reviewed context, and installed
lifecycle. The older editor's CLI inventory abort and subsequent successful empty
inventory are explicitly recorded, not hidden. See [Mac evidence](evidence/mac-final.md).

Windows/WSL qualified the preceding `f75b73bd…` package, including actual interactive
Copilot, Claude Code and Codex, live Chat/RAG/context and isolated lifecycle. Their
adapter bytes are unchanged in this build. The Copilot permission deviation and
fresh Default-permissions recheck remain part of [WSL evidence](evidence/wsl-followup.md).

**Final Spec150 validation is complete for the documented existing OpenClaw client
scope.** The exact `b13bdfe6…` artifact's RAG busy-state delta passed targeted actual
Windows/WSL confirmation: live inventory/citations, Refresh/Search overlap,
pending hide/reveal, native upload cancellation, isolated errors and late completion
after disconnect. See [final WSL evidence](evidence/wsl-final.md) and
[structured results](evidence/wsl-final-checks.json). No product bytes changed and
no further Mac handoff is required. The prior full WSL/assistant matrix and its
limitations remain valid for their stated scope. This is not publication or
all-platform acceptance. Broader live Hermes,
Remote SSH/second-distribution/reboot and network-write qualification remain outside
the recorded OpenClaw acceptance scope.

## Publication hold

T023 remains unchecked and held. Do not run `vsce publish`, upload to Marketplace,
create a public release or publish the blog. Merge to main is now authorized.
Source 1.9.0 metadata is prepared under repository contribution policy; it is not
a release tag or public-release claim. Existing publisher
authentication is not permission to publish. A new explicit owner instruction is
required, followed by review of the exact then-current artifact and its remaining
release qualification. No credential needs to be transferred or sent in chat.

## Future Spec151 boundary

Start a separate SDD cycle when the owner supplies the enhancement/aesthetic
direction. Preserve this working client and its backend boundary. Improved layouts,
visual hierarchy, navigation and advanced workflows can be proposed there; this
note is not a ratified Spec151 design or authorization to implement it now.
The separately raised pyATS MCP testbed-management request is not silently included.
The [milestone blog draft](wsl-milestone-blog-draft.md) stays local for review.
