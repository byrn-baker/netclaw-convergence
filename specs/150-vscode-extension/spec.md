# Spec 150: NetClaw for VS Code

Canonical integration target: `main`; recovered implementation began on
`150-vscode-extension-only`. Updated 2026-10-11.
Status: implementation complete for the documented client scope; publication held.
See [closure.md](closure.md) for final artifact, evidence and qualification limits.

Owner direction, 2026-10-11 after the qualified WSL return: finish implementation
and Mac qualification of the replacement, **do not publish**. T023/SC-005 public
release are held pending new explicit authorization and excluded from the current
implementation-completion milestone. Advanced enhancements and aesthetics belong
to a future Spec151; no backend or testbed-management expansion is added here.

Subsequent owner instruction authorizes PR/merge and branch consolidation onto
main, with one final targeted WSL confirmation. It does not revoke the publication
hold. See [current handoff](final-wsl-prompt.md).

## Scope and clarification

Install a published VS Code extension and connect it to an existing NetClaw or
Risk. Retain the mobile app logo. Support macOS and Linux extension hosts,
Windows desktop with WSL, and VS Code Remote SSH. NetClaw remains the runtime;
NCFED remains the federation/delegation implementation. Avoid base changes.
Any demonstrated necessary base addition must be separately explained and reviewed.
See [scope-recovery.md](scope-recovery.md) for preserved earlier branches.

The earlier expanded management architecture is superseded. Its implementation
and evidence remain in Git; its 79-task completion count does not transfer here.
No installation/bootstrap/upgrade, duplicate authorization service, device
automation engine, or new NCFED protocol belongs in this extension.

## User stories and acceptance

### US1: Connect and inspect (P1)

An engineer selects a running existing installation and works from a NetClaw
Activity Bar, command palette and native editor panels.

- Bind the returned installation identity and harness; show host context.
- Opening a WSL workspace uses that distribution's loopback, paths and credentials.
- Reject an identity change, stale view action, untrusted workspace or invalid URL.
- Render all HUD domain observations with source, unavailable state and refresh.
- Handle absent optional integrations without inventing healthy/empty results.

### US2: Converse and use knowledge (P1)

Chat, Canvas and local Avatar use the existing selected NetClaw runtime and owned
conversation APIs. RAG is an integrated panel with search, sources and uploads.

- Establish an extension-owned HUD session; never copy a browser session.
- Retain installation-scoped conversation references and Canvas state.
- Only explicitly selected context is sent to the configured model.
- Never automatically retry a submission with an uncertain outcome.
- Show runtime-specific model, attachment, cancellation and history limitations.

### US3: Manage existing capabilities (P1)

Inspect GAIT, tokenomics, provider/harness, standalone/Risk, iN2N/eN2N, environment,
DefenseClaw, OpenShell, integrations/skills, logs/docs, network/Intent, Science
Officer, mobile/edge and memory/meetings. Provide supported controls using existing
interfaces with exact destination and human review. Unsupported backend operations
must be explained explicitly, not replaced by another runtime implementation.

- Environment values stay masked; secret replacement uses password input.
- Review changes and preserve unrelated configuration; report actual outcome.
- Peering/delegation uses existing NCFED; existing policy remains authoritative.
- Selecting a profile never changes a running harness or service.
- Never manufacture approval, enforcement, network verification or rollback evidence.

### US4: Natural-language assistants (P1)

Copilot, Claude Code and Codex connect to an extension-bundled MCP client adapter.
They can inspect, request work from existing NetClaw and produce draft changes.

- Use the official MCP SDK; show the exact selected installation and tool surface.
- Expose no approval, direct configuration apply, arbitrary HTTP/CLI or shell tool.
- Draft proposals do not modify NetClaw. Actual operations retain backend policy.
- Explain that the adapter limits its tools; it is not an OS sandbox for an agent
  that already has unrestricted terminal access as the same user.
- Register only after explicit operator opt-in; preserve other assistant servers.

### US5: Install and publish (P1)

Deliver a reproducible VSIX under publisher `NetClaw`, test Mac and Windows/WSL,
push the exact source and provide a single WSL handoff prompt. Publish after
returned acceptance; verify Marketplace installation. Never label mock results
as real provider/platform acceptance.

## Functional requirements

- FR-001: Connect through existing host-local HUD/MCP interfaces without new backend installation.
- FR-002: Bind identity, host context and generation; invalidate stale requests/views.
- FR-003: Enforce workspace trust, fixed loopback URLs, bounded data and inert rendering.
- FR-004: Provide native navigation and searchable/paged domain panels for all US3 domains.
- FR-005: Provide owned Chat, Canvas, local Avatar and selected-context workflow.
- FR-006: Integrate RAG search, citations, document inventory and reviewed upload.
- FR-007: Offer existing supported settings/control paths with explicit target and review.
- FR-008: Keep secrets out of logs, assistant discovery, webviews and Git.
- FR-009: Reuse NCFED and existing execution/approval/audit; record limitations honestly.
- FR-010: Expose bounded assistant inspect/delegate/propose MCP tools, no approval/apply tools.
- FR-011: Preserve owner services/configuration during install, upgrade, disable and uninstall.
- FR-012: Package extension-owned dependencies/assets and mobile branding reproducibly.
- FR-013: Verify Mac behavior against unchanged NetClaw; keep WSL evidence separate.
- FR-014: Push source and final WSL handoff; publish only the validated artifact.

## Edge cases

Stopped HUD, replaced installation on the same port, missing feature, lost response,
expired session, disconnect during review, several editor windows, oversized data,
hostile returned text, WSL restart, revoked existing permission and old extension
state must produce explicit outcomes without crossing targets or replaying work.

## Success criteria

- SC-001: Connect to an existing ready installation without changing its runtime code or configuration.
- SC-002: Every advertised domain opens an actual observation or a specific unavailable explanation.
- SC-003: Identity/trust/target-switch/uncertain-submit tests pass; assistants cannot call approve/apply.
- SC-004: Real editor and VSIX lifecycle checks pass on Mac, then Windows/WSL.
- SC-005: Published listing and installed extension match the validated source/artifact.

## Assumptions and evidence limits

Users already operate a supported NetClaw with its HUD running. Remote access uses
VS Code's existing WSL/SSH extension host, not publicly exposed HUD endpoints.
Native Windows NetClaw hosting, Codespaces and browser VS Code are out of scope.
Runtime-specific unsupported operations are reported; adding missing backend
functionality is not implied. All retained user stories remain release review items.
