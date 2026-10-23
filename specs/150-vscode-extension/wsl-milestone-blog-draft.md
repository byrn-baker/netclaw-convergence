# Draft: qualifying NetClaw’s VS Code extension across Windows and WSL

Draft for John’s review. Not published. WordPress MCP was not available to this
agent; retain this local draft for manual review/publication after release review.

We took the NetClaw VS Code extension through a real Windows desktop with its
extension host running in WSL, connected to an existing OpenClaw installation.
The useful outcome was more than a successful build: two visible client defects
were reproduced, fixed and checked in the packaged extension before publication.

Switching away from a webview destroys its frontend state unless that state is
saved. Our message counter restarted while the extension host still remembered
previous messages, so its replay guard correctly rejected the new counter values.
Persisting the counter per view restored Chat, Canvas, RAG and observation views
without removing the replay protection or keeping every hidden document alive.
A separate Windows-local test exposed a command-palette call that ignored its WSL
filter. The extension now explains the required host and opens the filtered picker.

Qualification used actual provider answers and a harmless indexed RAG document,
explicit editor/citation context, Canvas export/import, local Avatar rendering,
and installed upgrade/disable/re-enable/uninstall. Settings writes and failure
injection ran only against isolated unchanged HUD fixtures. The owner’s real
settings reviews were cancelled, and prepared service commands were never run.

Copilot, Claude Code and Codex each used the scoped MCP adapter interactively.
Human consent, inert drafts, delegated answers and disabled-registration refusals
were observed. We retained an important caveat: Copilot’s permission picker showed
Allow all after its first delegation. We restored Default permissions and repeated
the check with normal result consent; the evidence records that deviation instead
of presenting an uninterrupted default-mode run.

The prerequisite repairs were separately reviewed and bounded: the existing HUD
used its locked Node dependencies and supported runtime, and only its RAG process
used an isolated compatible Python environment. Backups remain local. Gateway,
federation, credentials and owner source were preserved.

This is not a claim that every optional feature or platform is qualified. The
run used the existing OpenClaw installation, kept active owner work running,
and reported stale/unavailable observations as they appeared. The final VSIX now
returns to Mac for review and requalification before Marketplace publication.

## Mac completion addendum — unpublished draft

Spec150 implementation is complete for the documented client scope. Mac
qualification caught and corrected a RAG overlap issue: controls now wait for
active work and remain disabled after disconnection. The exact final VSIX passed
installed Mac checks, real provider/context integration and current-editor
lifecycle. The final small RAG delta still needs targeted WSL confirmation before
a future public release. Prior Windows/WSL and assistant evidence remains scoped
to the exact artifact tested there; no backend source changes were introduced.

John explicitly requested **no publication yet**. Marketplace and blog publication
are held. Advanced workflows and aesthetics will be specified separately in
Spec151; this draft does not authorize that implementation or publication.
# Main consolidation addendum — unpublished

The owner authorized consolidating the completed thin extension into main and
archiving superseded experiment branches. Source 1.9.0 metadata is prepared; the
extension remains 0.1.0 and Marketplace/GitHub/blog publication is still on hold.
One focused Windows/WSL check covers the final RAG busy-state correction. Advanced
enhancements and aesthetics will start through a separate Spec151 after this work.

## Final Windows/WSL confirmation addendum — unpublished

The final Mac artifact now passes the targeted RAG confirmation in the actual
Windows desktop editor with its extension host in WSL. Busy controls survive tab
recreation, native cancellation releases them, errors permit explicit next work,
and late completion cannot reactivate a disconnected view. Live retrieval used
the retained harmless fixture; deterministic fault checks used an isolated
unchanged HUD. No product bytes or owner services changed, and no provider request
was needed. The documented Spec150 validation is complete with the prior scope
limits preserved. No further Mac handoff is required. Publication remains held;
Spec151 has not started. This draft stays unpublished for owner review.
