# Implementation Plan: Complete Comms Setup

**Branch**: `155-border-channel-setup` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Extend the existing Spec153 installer with a complete, runtime-specific Comms discovery and onboarding flow. Preserve the setup engine, separate installation homes, native review authority and existing operational capabilities. Promote the researched channel inventory into a versioned catalog; distinguish native conversation ingress, optional runtime interfaces and existing NetClaw Twilio/Zoom tools. Support multiple distinct channels, complete access settings, owned Hermes messaging services, real wizard test requests and separate readiness observations.

The owner authorized SDD planning, implementation and isolated verification on 2026-10-25. Existing running claws are not migration targets. Source development needs no imported credentials. External tests remain specific native-reviewed actions, and unavailable accounts/platforms remain visible qualification gaps.

## Technical Context

**Language/Version**: Python 3.10+ standard library for setup engine/catalog/validation; TypeScript 5.9 and existing browser JavaScript for VS Code.
**Primary Dependencies**: Existing VS Code APIs, esbuild, JSON Schema subset validator, Python unittest, Node test runner and existing runtime CLIs. No new UI framework or general shell endpoint.
**Storage**: Non-secret schema-1 plans; private per-installation environment/configuration; existing external setup-run journal and owned artifact records. No bulk environment import or credential values in frontend state.
**Testing**: Existing Python setup suites, extension unit/editor tests, catalog/schema coherence checks, controlled native-command fixtures, isolated Mac installer acceptance and separately recorded WSL/provider qualification.
**Target Platform**: macOS and WSL2, using the currently pinned OpenClaw and Hermes baselines unless a separately reviewed baseline change is justified.
**Project Type**: Existing installer engine, CLI and VS Code extension.
**Performance Goals**: Local catalog browsing and filtering without provider/network calls; bounded command timeouts and existing checkpoint/cancellation behavior.
**Constraints**: Preserve owner/role boundaries, no silent shared-policy or runtime upgrades, no model/device/domain-operation retesting, no implicit calls/messages/meeting capture. Real external effects need exact scoped native review.
**Scale/Scope**: 33 current OpenClaw index entries, 28 Hermes platforms, related interfaces and existing NetClaw Comms integrations. One account per platform per home initially; unsupported same-platform multiplicity must be explicit. Distinct channels retain independent choices.

## Constitution Check

| Principle | Design disposition |
| --- | --- |
| I–III: safety, baseline and change control | Installer-only work; no device operations or production configuration. Owned setup journal remains the baseline for local effects. |
| IV: audit | GAIT session `spec155-comms-sdd-20261025`; durable setup effects, artifact intent and explicit unknown outcomes. |
| V–VII: MCP-native/modularity | Reuse existing Twilio/Zoom MCPs and skills; new code is setup support, not a duplicate operational server. |
| VIII: verification | Validate written configuration and process ownership; distinguish synthetic, local and live evidence. |
| IX/XIII: security/credentials | Native prompts and private owned writers; precise role contracts; no exported `.env`, global credential borrowing or secrets in reports. |
| X/XI/XII: observability/coherence/docs | Update installer catalog, wizard/CLI/assistant guidance, readiness reports, README/SOUL/TOOLS and affected examples. Existing MCP tool counts are not inflated by setup catalog entries. |
| XIV: external communication | Test messages/calls/meeting capture are never implied by catalog selection or discovery. |
| XV: backwards compatibility | Additive schema-1 fields and normalized legacy plans; retain no-channel and original single-channel behavior with honest evidence. |
| XVI: SDD | Ratified Spec155 → research/design/contracts → tasks → analysis/fixes → implementation. |
| XVII: milestone documentation | Draft a local milestone article when implementation completes; publication remains a separate action. |

Pre-design review: no constitution exception is required. Post-design review: effect binding, role placement, private credentials and inert discovery are covered by the design/contracts and explicit tasks. Native helper packaging and actual process-lifetime qualification remain required implementation gates, with no exception to the safety or completion criteria.

## Architecture decisions

1. **One authoritative Comms manifest.** Add `config/components/comms.json` with a validated schema, runtime/version/native-ID mapping, official documentation, typed capability kind, eligible role/host, settings/access contracts, dependency and onboarding method, startup effects and observation contract. Include every researched inventory entry. Missing adapters remain incomplete; source absence and pinned incompatibility require evidence. Generate executable channel choices from this metadata without overwriting component/skill catalog sources.
2. **Preserve canonical IDs.** Plans use lowercase hyphenated IDs; native IDs such as Hermes `google_chat` are adapter metadata. Channel arrays and requested tests accommodate the complete catalog. Retain one account per platform/home; do not infer support for duplicate platform accounts from UI multiplicity.
3. **Explicit onboarding effects.** Add deterministic owner/channel configuration effects after base runtime onboarding and before services. Include Comms manifest hashes in review binding. Apply a fixed versioned command/config contract, never arbitrary plan-provided commands. Unknown, cancelled or incomplete prerequisites prevent activation.
4. **Guided setup with verified native handoffs.** Prefer typed private settings for documented stable fields. Where account login/pairing requires a native UI, use the existing private engine-owned terminal, exact effect identity, reviewed side effects and selected-home environment. Pin dependency acquisition. Read back the resulting account configuration; do not rerun base onboarding afterward or treat a zero exit as success. Handoffs that cannot bound their effects remain explicitly unavailable until that contract is implemented.
5. **Scope access and services.** Collect allowed users/rooms and mention/pairing policy before activation. Reuse the gateway service role with a Hermes-specific command when selected channels need it. Keep the HUD companion and federation separate. Observe exact service identity and ports; do not adopt neighboring processes.
6. **Readiness is per surface and direction.** Record configuration, authentication, transport, inbound and outbound observations, each with state/time/account binding. Preserve private receipt details separately and export only allowlisted evidence. Fix wizard tier-5 drafting so the chosen tests exist. Twilio submission is distinct from final delivery; missing receipts pause without replay.
7. **Comms tools have independent owners.** Keep full Twilio/Zoom MCP bundles on eligible Focused/member claws. Add guided explicit component selection without requiring an unrelated member preset. The user-facing view cross-links these tools to Border conversation options but does not share credentials implicitly.
8. **Zoom placement and inert discovery.** Establish an explicitly owned same-host connection to the Border's existing loopback bridge where meeting input is selected. Keep the bridge private. Add a bounded installer-discovery mode that prevents background listeners/capture. Report RTMS, panel, historical connector and optional camera outcomes separately. Validate selected-runtime assumptions before claiming readiness.
9. **Twilio surfaces remain distinct.** Native SMS auth tokens, NetClaw MCP API credentials and optional voice integrations retain their own contracts. Preserve shared-number routes and owned configuration. Existing calling/alert behavior is reused; it is not invoked during local installer qualification.
10. **Complete coverage without false closure.** Every documented entry has a disposition and source. Source implementation, isolated installer acceptance and actual provider/platform qualification are separate columns. No missing live account becomes a simulated live pass or an unsupported-runtime claim.

Hermes Home Assistant is a mixed event/tool integration and is Focused-only in this baseline. Its native credential enables device tools, so ordinary Border channel authority is insufficient. This is an installer role restriction with source evidence, not an assertion that Hermes lacks the feature. Channel effects, Zoom bindings and legacy test-direction defaults use the exact additive contracts in `data-model.md`.

## Project Structure

### Documentation

```text
specs/155-border-channel-setup/
  spec.md
  plan.md
  research.md
  data-model.md
  channel-inventory.{md,json}
  investigation.json
  contracts/comms-setup.md
  quickstart.md
  tasks.md
  analysis.md
  verification.md
  checklists/requirements.md
```

### Source

```text
config/components/comms{,.schema}.json
config/components/{catalog,schema}.json
config/claw-plan.schema.json
scripts/build-catalog.py
scripts/check-comms-catalog.py
scripts/lib/setup_comms.py
scripts/lib/setup_{plan,engine,components,harness,secrets,risk,verify,live,report,cli,transport}.py
scripts/setup-service.py
extensions/netclaw-vscode/src/setup/comms.ts
extensions/netclaw-vscode/src/setup/{data,native-terminal,review,reports}.ts
extensions/netclaw-vscode/src/views/setup-wizard.ts
extensions/netclaw-vscode/resources/setup-wizard.{js,css}
mcp-servers/zoom-rtms-mcp/server.py
mcp-servers/twilio-env-mcp/{server.mjs,package.json,package-lock.json}
mcp-servers/twilio-voice-mcp/webhook_server.py
installer/assistant-skills/netclaw-install/SKILL.md
tests/test_setup_comms*.py
extensions/netclaw-vscode/test/setup-comms*.test.mjs
```

Use existing files where practical; the listed new modules isolate catalog resolution and Comms contracts from the large wizard/engine. Additional service integration edits must be driven by the reviewed contracts and tests.

## Delivery and verification phases

1. Catalog/schema and role/compatibility foundation; reference coverage and legacy-plan tests.
2. Readiness model, deterministic effects, credential/config ownership and native handoff authority.
3. Wizard/CLI/assistant multi-channel setup and Comms tools discovery/selection.
4. Owned messaging services, Twilio/Zoom setup contracts and inert discovery.
5. Per-channel verification/reporting, recovery and privacy cases.
6. Isolated local acceptance, actual selected-provider checks where identities are available, WSL handoff and honest closure report.

A feature is not called 100% complete while any supported adapter, required installation flow or claimed qualification remains unverified. The task ledger retains those gates until evidence closes them.

## Complexity Tracking

No constitution violations or new general-purpose execution surface are proposed. The separate Comms manifest is necessary because upstream channels, runtime-related interfaces and existing NetClaw tools have different ownership and lifecycle semantics; adding them all as identical channel choices would erase those distinctions.
