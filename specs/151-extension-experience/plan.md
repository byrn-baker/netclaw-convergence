# Implementation Plan: NetClaw extension experience

**Branch**: `151-extension-experience` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

## Summary

Deliver a cohesive, AYN-inspired VS Code workbench: blue actions, semantic cards, useful copy, theme-aware forms, bundled branded art and an attributable Three.js BGP view. Add safe testbed device/document management and contextual per-MCP configuration with reviewed, bounded setup operations. The five original owner clarifications and the security amendment are ratified. Complete all stories locally; no packaging or external publication.

## Technical Context

**Language/Version**: TypeScript 5.9 / VS Code ^1.102; browser JavaScript; HUD Node >=24.19 <25 or >=26.1; existing isolated Python helpers.
**Primary Dependencies**: Existing Three.js 0.185.1, esbuild, Express, yaml CST and js-yaml. No adaptivecards runtime or new framework.
**Storage**: Existing testbed YAML and selected runtime .env/config; private backups and setup evidence. No draft secrets persisted in webview state.
**Testing**: Node test runner, JSDOM, existing isolated real-HUD fixtures, VS Code source-development acceptance, existing Python helper tests.
**Target Platform**: Existing Mac/Linux/WSL/Remote extension-host boundaries; native Windows remains unsupported. Mac acceptance here does not qualify other hosts.
**Project Type**: VS Code extension plus bounded additions to its existing HUD configuration service and setup helpers.
**Performance Goals**: 500 inventory entries filtered within 250 ms after input settles; page size 50; 3D at most 200 nodes, render on demand, DPR <=2.
**Constraints**: 256 KiB testbed source,512KiB masked draft and1MiB testbed bridge, bounded YAML expansion/depth; no device calls; fixed operation allowlists; existing installation/trust fences; no package/push/live deployment.
**Scale/Scope**: All 22 domain views and Chat/Canvas/Avatar/RAG/native flows; six user stories including the owner security amendment.

## Constitution Check

Pre-research and post-design gates PASS within the owner-authorized scope:

- I–IV, VIII: no network configuration work. Testbed/config writes use baseline, explicit review, private recovery and verification. Setup produces sanitized local operation evidence; this development session uses GAIT. Existing production/Local-Lab device change control remains intact.
- V–VII, IX–X: this is an operator UI for existing MCPs and facilities, not a new tool integration. No new MCP server, device tool, vendor logic or assistant authority. Necessary HUD additions stay inside its existing inventory/configuration responsibility.
- XI–XIII, XV: update extension/root documentation, SOUL/TOOLS references and verify catalog coverage; no new catalog entry, installer component, skill or environment variable is introduced. Existing registrations/helpers are reused. Credentials stay local and absent from ordinary displays. Compatibility fallback for an old HUD is read-only guidance, never unsafe raw writes.
- XIV, XVII: no external communication/publication. A milestone draft may be stored locally; the owner's explicit hold supersedes publication workflow.
- XVI: spec and five clarifications precede plan/tasks/analysis; all findings must be fixed before implementation.

No constitution amendment or exception is required. The Spec150 client-only scope is superseded only for the bounded supporting changes explicitly allowed by Spec151.

## Project Structure

```text
specs/151-extension-experience/
  spec.md plan.md research.md data-model.md quickstart.md tasks.md
  contracts/experience.md contracts/testbed.md contracts/mcp-setup.md
  analysis.md verification.md
extensions/netclaw-vscode/
  src/webview/{shell,panel,bridge}.ts
  src/views/{testbed,mcp,setup}.ts
  src/client/{domains,setup}.ts
  resources/{workbench.css,data.js,presenters.js,testbed.js,mcp.js,brand/}
  webview/topology.js
  test/ scripts/editor.mjs build.mjs
ui/netclaw-visual/
  testbed-document.js mcp-configuration.js
  server.js test/
scripts/ # existing scoped setup/registration/lifecycle helpers
```

## Design and sequencing

1. Shared semantic shell, domain presenters and card/form tokens. Observation provenance and unknown states remain visible; bounded source details are secondary. Host actions use fixed IDs, never arbitrary record routes or commands.
2. Connection prompts explain nickname vs API URL and extension-host locality. Preserve existing profile/identity verification.
3. Testbed document service owns safe parsing, exact keys, masked editable YAML, guided CST patches, YAML/JSON/CSV conversion, preview/digest/commit/recovery. Mount in existing HUD with active-session refusal, consent revocation and installation header. Forms and advanced drafts stay in memory; exports use native file dialogs and explicit credential choice.
4. MCP descriptors join integration fields to known components explicitly. Configuration API adds revision-aware scoped save and internal value verification. Setup coordinator constructs fixed argv from reviewed filesystem bindings, stores private baseline/evidence, serializes per installation and reports verified/failed/unknown states. Initial direct operations: existing staged pyATS/GAIT installation, supported canonical OpenClaw registration with helper-side expected-revision checks, and owned federation restart. Hermes registration with existing blocks is explicit manual guidance unless the existing converter can safely apply and verify the selected entries. Unsupported lifecycle operations have clear explanations and reviewed staging where applicable.
5. Generate local decorative artwork; add Three.js BGP-session view alongside complete readable list. No inferred physical links or auto-orbit. Dispose graphics and update theme without rebuilding forms.
6. Run contract/interaction/regression checks, isolated real-editor visual matrix and performance measurement. Fix findings, update evidence/tasks and leave a local source-development preview.

## Complexity Tracking

No new service/process/framework. The two bounded HUD modules are necessary because it owns testbed consent/session state and private env values; direct extension filesystem writes would bypass those responsibilities. The setup coordinator reuses existing helpers rather than duplicating installers.

## Security amendment design and sequencing

US6 adds a native extension-host adapter (`src/client/security.ts`), controller (`src/views/security.ts`) and shared-card UI (`resources/security.js`). It reuses fixed supported vendor CLI operations rather than adding a broad HUD shell-execution route or editing vendor databases. Native target binding captures existing runtime home/identity and explicit shared security scope. DefenseClaw uses its selected data/config directory and revision-aware config writer; OpenShell uses an explicit config root, gateway, workspace and sandbox with verified full policy reads. No implicit active gateway, HOME reassignment, TLS bypass or generic shell argv.

Capability probes are bounded and version/shape gated. Supported modern DefenseClaw uses config get/set for `asset_policy.tool` and a small guardrail-key allowlist, with `--expect-sha256`; unknown schemas stay read-only. OpenShell reads full JSON policy, changes network_policies only and applies its complete preserved policy with `policy set --wait`, followed by full readback. OpenShell lacks an exposed compare-and-swap flag: immediately re-read before apply, serialize this client, explicitly disclose the external-writer race, and refuse an effective global policy. Scope metadata/executable/config identities form review baselines. Private evidence, original policy/config and unknown-outcome recovery accompany writes; no automatic restore that could overwrite intervening changes.

Display sanitized status facts and bounded alerts/logs separately from policy editors. Native confirmation names scope and requires an explicit weakening acknowledgment for permission expansion or uncertain direction. Field editing never sends a device command. Runtime lifecycle remains unchanged. Amend requirements/contracts/tasks and resolve analysis findings before implementation, then rerun targeted regressions and both-page editor acceptance.
