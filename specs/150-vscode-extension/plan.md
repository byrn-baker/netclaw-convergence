# Implementation Plan: extension-only NetClaw workbench

Integration target `main`; recovery branch `150-vscode-extension-only`;
2026-10-11; [spec](spec.md).

## Summary
Reuse presentation and packaging from 4ed565b; implement a thin client of unchanged
NetClaw 1.8.0 (f943637). No operator management backend. New dependencies stay in
extensions/netclaw-vscode. Backend gaps require explicit per-feature evidence.

## Technical context
TypeScript, VS Code API >=1.102, Node extension host, esbuild, official MCP SDK.
HTTP is the existing HUD presentation interface; tool integration remains MCP.
Native panels use bundled JavaScript/CSS, React/Three only for the existing Avatar.
Store labels/bindings in extension-local storage and sessions in SecretStorage;
no workspace settings or Settings Sync for private state. MCP clients own their
sessions independently. Fixed loopback endpoint, installation header on requests,
redirect refusal, byte/time bounds, no arbitrary backend route from webviews/tools.

## Constitution check
Existing safety, approval and audit stay in NetClaw. No device access, runtime
installation, registered backend capability or credential migration is added.
Consequently installer/catalog/SOUL/MCP configuration changes are inapplicable;
extension docs and MCP tool documentation carry the new client capability.
Use official SDK, scoped tool inventory, human-reviewed configuration actions and
honest observations. Source-driven tests and real editor checks are required.
No modification to the constitution is proposed. Generated agent context is kept
inside this spec rather than rewriting the owner's base AGENTS.md.

## Design and sequence
1. Existing HUD client: verified identity, independent owned session, bounded requests.
2. Native UI: reuse navigation, rendering, logo; map domains to existing endpoints.
3. Owned chat/context/Canvas/Avatar; integrated RAG and reviewed configuration.
4. MCP adapter: fixed inspect domains, owned delegation, private local proposal drafts;
   no backend grant service and no assistant approval/apply methods.
5. Mac isolated unchanged-HUD and actual editor/VSIX checks; final WSL handoff.

## Structure
extensions/netclaw-vscode/{src,resources,webview,test,scripts,package.json}
specs/150-vscode-extension/{spec.md,plan.md,tasks.md,research.md,data-model.md,contracts,evidence}
Editor/platform harnesses remain inside the extension; none modifies base tests.

## Validation
The owner explicitly held publication after the final WSL return on 2026-10-11.
Finish implementation and Mac qualification; retain exact-artifact/platform
evidence and any remaining release checks without publishing. Advanced enhancement
and aesthetic work is future Spec151 scope.

The later owner instruction authorizes source PR/merge and cleanup onto main.
Use [final-wsl-prompt.md](final-wsl-prompt.md) for the exact-package RAG delta;
publication stays held. The required source version metadata is prepared without
a release tag or Marketplace operation.

Transport tests cover identity changes, cross-target callbacks, redirect/URL
refusal, session separation, timeouts and bounded responses. Test user flows,
assistant denied tools, package contents and unchanged backend paths. Use real
unchanged HUD processes with synthetic isolated configuration, labeling all mock
provider results. Record actual editor integration separately. WSL execution is
owner-machine handoff; no Mac result substitutes for it.

## Complexity control
No new daemon/worker/journal, authority database, backend proposal service or
configuration locking migration. Adapt to existing per-operation semantics;
record unavailable behavior rather than manufacture uniform guarantees.
