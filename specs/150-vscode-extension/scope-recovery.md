# Spec 150: extension-only recovery

Historical audit and recovery plan. The correction was subsequently implemented;
current completion, artifact and publication hold are in [closure.md](closure.md).
Original audit findings and estimates below are preserved as historical context.
The later main consolidation replaces superseded branch names with verified
[archive tags](evidence/archived-refs.json); the recovered client history is merged
through its final PR. Do not merge any archived backend experiment.

Date: 2026-10-11. Status: source audit and recovery plan; implementation has not
been migrated or accepted on this branch.

## Owner's correction

The product is a VS Code client for an **existing** NetClaw or Risk. Avoid changes
to NetClaw's base. Existing NCFED owns peering and delegation; existing NetClaw
owns execution, policy, approval and audit. The extension presents and calls those
capabilities. It does not become a NetClaw installation.

The implementation expanded that boundary. This was an implementation/planning
error, not a request from the owner. The expanded task list must not drive further
backend work or be used to claim extension completion.

## Preserved work and clean baseline

| Reference | Purpose |
| --- | --- |
| `origin/main` at `f943637` (NetClaw 1.8.0) | Unchanged recovery baseline |
| `150-vscode-extension-only` | New recovery branch based on that baseline |
| `150-vscode-extension-release` at `4ed565b` | Preserved expanded implementation, pushed; not the corrected release candidate |
| `150-vscode-backend-experiments` at `5cf5779` | Preserved remote-execution prototype and explicit experiment status, pushed |
| Owner checkout `150-vscode-extension` at `aa27953` | Preserved original workspace |

No implementation has been merged into main or published to Marketplace. The
recovery checkout is `/Users/john.capobianco/netclaw-spec150-extension-only`.
The other branches retain the earlier code and evidence without rewriting history.

## Concrete dependency findings

The extension at `4ed565b` has 38 TypeScript source files; 30 directly reference
one or more of 15 new `operator_*` methods. It has 27 view modules. Its connection
layer launches `scripts/netclaw-operator.mjs` and requires the new operator
identity contract. That service does not exist on unchanged main. Copying the
extension directory alone would therefore produce a nonworking client.

The packaged VSIX does not contain a NetClaw runtime. The problem is the backend
dependency and expanded project scope, not a runtime hidden inside VS Code.

| Area | Reuse | Required correction |
| --- | --- | --- |
| Navigation, branding, webview rendering | Activity Bar, command/view structure, mobile logo, paging, themes, inert rendering | Keep relevant UI; remove commands whose only implementation is the added backend |
| Connection and profiles | Explicit target selection, workspace trust, extension-host context, generation checks | Replace operator launcher/identity contract with existing installation interfaces and capability discovery |
| Overview, Risk, federation, integrations | Display and selection components | Map to existing HUD inventory and NCFED tools; no new peer execution engine |
| Chat, Canvas, Avatar | UI and explicit selected-context handling | Use existing owned conversations, cookies, task/request identities and runtime capabilities; adapt OpenClaw/Hermes differences |
| RAG and knowledge | Integrated RAG panel and reviewed document actions | Call existing RAG APIs/MCP; do not introduce another ingestion/operation service |
| Configuration and security | Redacted field review and posture views | Use existing authorized controls; remove dependence on added proposal ledgers, service registries, scanners and base-writer migrations |
| Copilot, Claude Code, Codex | Registration UX and selected-installation context | Replace custom backend client-grant service. Any extension-owned MCP adapter must be a narrow client of existing interfaces, with no approval tools or independent execution authority |
| Build/package/tests | Mobile icon, packaging discipline, host lifecycle/performance test methods | Remove build dependency on HUD's installed node_modules; update integration tests for unchanged main and retest the resulting VSIX |

The build also imports two existing HUD UI modules and copies Pal resources.
Reusing those assets need not modify NetClaw's base, but extension dependencies
and build inputs must be explicit and reproducible.

## Existing interfaces verified in main source

These are source findings, not live acceptance results:

- `ui/netclaw-visual/server.js` exposes `/api/runtime` with installation identity,
  selected harness, readiness and capability flags; it rejects a mismatched
  `x-netclaw-installation` header.
- Existing HUD routes cover configuration inventory, masked environment fields,
  budget controls, runtime/security/OpenShell posture, tokenomics, graph, NCFED,
  terminal workflows, documentation/logs, chat and RAG. Actual capability and
  authorization differ by runtime and operation.
- `src/security/local-access.js` explicitly permits originless local requests
  with an accepted Host; it checks socket address, Host and optional Origin.
  The extension must honor that boundary. WSL/Remote SSH should use the workspace
  extension host on the target, accessing the target's loopback service. Do not
  expose the HUD publicly, spoof origins, or borrow a browser's private cookies.
- `src/hud-server/runtime/routes.js` provides existing Hermes owned conversation
  and request routes. The client must establish its own session through existing
  session creation and preserve ownership/uncertain-outcome behavior. OpenClaw
  routes require a separate mapping; a common UI does not prove identical APIs.
- `mcp-servers/n2n-mcp/server.py` already provides `n2n_status`, peer capabilities,
  grants, `n2n_invoke`, `n2n_chat`, `n2n_delegate`, task status/result/cancel, Risk
  membership and routing. Existing federation remains responsible for admission,
  trust, approval and execution. Do not expose its approval methods to assistants.

Existing unavailable responses remain authoritative. For example, main explicitly
limits some Hermes budget, security-write and hosted-avatar operations. Building
missing runtime support is not extension work.

## Gaps that must remain explicit

1. Existing APIs do not imply a universal management proposal, optimistic revision,
   audit or replay contract. Remove invented universal guarantees. Map each action
   to its actual existing behavior; where safe review/apply cannot be supported,
   identify the exact gap before deciding how the UI should handle it.
2. Do not register an unrestricted existing NCFED server with an assistant and
   call that scoped access. Its tool catalog includes approval and administrative
   operations. Prove the assistant-facing allowlist and inherited backend policy;
   assistants may inspect, request permitted delegation and draft proposals, but
   never approve their own work. The added backend grant service is not a default
   prerequisite for fixing this.
3. Service control and runtime switching must use existing supported controls.
   A connection profile change must never switch a running installation itself.
4. A source route's existence is not live validation. The rewritten client needs
   real Mac testing against unchanged NetClaw, followed by the final WSL handoff.

## Recovery sequence and checkpoints

1. **Preserve and map — completed.** Preserve remote branches, create the clean
   baseline, identify transport/assistant dependencies and document this audit.
2. **Correct SDD before implementation.** Reconcile spec, plan, contracts and tasks
   with the owner correction. Retain requested HUD domains and RAG. Separate actual
   existing-platform limitations from extension defects. Keep historical evidence
   and task results labeled with their old commit/architecture.
3. **Migrate client integration.** Bring across reusable extension files and tests;
   replace the operator dependency with thin adapters to existing HUD/MCP/CLI
   interfaces. Prove identity, connect, inspect, disconnect and target switching
   against unchanged main before migrating write flows and assistant access.
4. **Verify on Mac.** Test the rewritten UI, owned chat, RAG, supported settings,
   existing NCFED interactions and named assistants. Verify workspace trust,
   isolation, denied actions, uncertain outcomes and packaging. Prior tests against
   the added backend do not count as acceptance of the replacement client.
5. **Final WSL handoff and publication.** Push the exact candidate, provide one
   return prompt and focused Windows/WSL checks. Reconcile returned evidence and
   any fixes, then publish the ready extension using the already authenticated
   NetClaw publisher. Marketplace processing time is outside this estimate.

Normal implementation paths on the recovery branch are
`extensions/netclaw-vscode/`, `tests/vscode/`, `specs/150-vscode-extension/` and
extension-specific documentation. Necessary root documentation updates may describe
the extension without changing runtime behavior. Do not copy the added management
servers, HUD management modules, federation rewrites, config migrations, service
registries or runtime changes. Any truly unavoidable base change needs a separate,
specific explanation and separately reviewable change; do not silently fold it in.

Acceptance includes a path-level comparison against `f943637` showing no changes
to NetClaw runtime, installer, existing MCP server or configuration-writer code.

## Time estimate

Preservation and Git separation are done. The current planning estimate for the
remaining Mac recovery is **4–8 hours of focused work**, excluding WSL execution
and Marketplace processing. This is a provisional engineering estimate, not a
completion guarantee. The largest uncertainty is preserving the requested assistant
permissions through existing interfaces without rebuilding backend authority.

The next implementation checkpoint is a working extension connection and core
read views against unchanged NetClaw. Report any API limitation there; do not spend
additional hours implementing missing backend features under the extension scope.

The historical 52/79 expanded-plan count is not a completion percentage for this
recovery. No corrected-extension acceptance is claimed by this document.
