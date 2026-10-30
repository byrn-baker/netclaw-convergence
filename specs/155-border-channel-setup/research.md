# Investigation: Border channel setup

**Date:** 2026-10-25
**Inspected release:** source 1.12.0 / extension 1.2.0, commit `a5480b4cea4cf3729a25576fa75394b41257faab`
**Result:** The step exists, but full channel onboarding is incomplete. A follow-up specification is warranted. This is source/documentation investigation, not live-channel testing.

## Evidence in the released installer

| Finding | Evidence | Consequence |
| --- | --- | --- |
| A conversation-channel step already exists | [Wizard rendering](../../extensions/netclaw-vscode/resources/setup-wizard.js), [channel handler](../../extensions/netclaw-vscode/src/views/setup-wizard.ts) | Extend the existing step; do not claim it was absent. |
| Channels belong to the Border or Focused claw | The handler rejects members; [plan validation](../../scripts/lib/setup_plan.py) rejects member channels | Preserve this ownership boundary. |
| Wizard and CLI choose one channel | The wizard replaces `claw.channels` with one selected entry; [CLI draft builder](../../scripts/lib/setup_cli.py) uses a single choice | Add multiple selections without discarding retained settings. |
| The current catalog is narrow | [Catalog](../../config/components/catalog.json): Slack, Telegram, Discord, Webex, None | Teams and most documented upstream choices are absent. The Microsoft Graph component is not Teams conversation onboarding. |
| Slack/Discord/Telegram receive basic credentials/configuration | [Harness adapter](../../scripts/lib/setup_harness.py), `base_config()` / `onboard()` | Token presence and local configuration are not complete permission, pairing or transport setup. |
| OpenClaw configuration sets group allowlist policy without configuring the allowed rooms/users | `base_config()` writes `enabled`, `configWrites` and `groupPolicy` for those channels | Safe default, but no guided access setup or proof that a group can reach the Border. |
| Webex is intentionally blocked | [Adapter metadata](../../config/components/harness-adapters.json), [refusal test](../../tests/test_setup_harness.py) | The pinned plugin uses a removed registration interface. Qualify a compatible integration; do not bypass the refusal. |
| Hermes has no installer-owned messaging gateway | [Service roles](../../scripts/lib/setup_risk.py) add `gateway` only for OpenClaw; [service launcher](../../scripts/setup-service.py) rejects a Hermes gateway role | A Hermes HUD/companion and federation service do not establish messaging ingress. |
| Wizard tier 5 does not create test requests | `setup-wizard.ts` changes `verification.tiers` and retains/defaults `channelTests`; it never adds an entry | Selecting the tier alone leaves a new plan without channel tests. Imported entries can still run through the engine. |
| The engine already has consent-bound send checks | [Channel contracts](../../scripts/lib/setup_channels.py), [live verifier](../../scripts/lib/setup_live.py), [tests](../../tests/test_setup_live.py) | Reuse and extend these protections; add complete wizard account/destination selection and separate inbound evidence. |
| Previous acceptance did not prove real channel operation | [Spec153 verification](../153-ide-installer/verification.md), [Mac return](../153-ide-installer/mac-return-installer-acceptance.md) | Required local installer passes and optional skipped channel delivery must remain separate claims. |

[Read-only investigation results](investigation.json) were produced by inspecting the catalog and invoking pure configuration, service-role and validation functions. They confirm Teams absence, the minimal Slack config, Hermes Risk roles of HUD/federation only, and Webex refusal before apply. No installer, native service, provider, messaging account or device was operated.

## Complete upstream reference scope

The owner expanded the request from several examples to **all** documented channels for each runtime. The [human-readable inventory](channel-inventory.md) and [structured inventory](channel-inventory.json) contain every current index/comparison entry and the related communication guides. Each platform links its own official documentation.

- [OpenClaw channel index](https://docs.openclaw.ai/channels): 33 current entries. The [pinned-source index](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/docs/channels/index.md) documents a different set/classification. Discovery and plugin requirements must be bound to the selected version rather than copied from current documentation blindly.
- [Hermes messaging gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging): 28 comparison platforms plus related guides. The [pinned-source documentation](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/website/docs/user-guide/messaging/index.md) also documents those platforms. Documentation is broader than the NetClaw setup adapter and is not installed-readiness evidence.
- Webex remains an explicit NetClaw requirement outside those indexes, using [Webex bot guidance](https://developer.webex.com/messaging/docs/bots) and the [pinned external plugin source](https://github.com/JimiHFord/openclaw-webex/blob/1bc3274f262f946e0929de501d0d40c48bf3ef5a/src/plugin.ts). Hermes support is not asserted.

The complete inventory includes installation classes and version differences where established. Detailed plugin/version dependencies, authentication contracts and actual qualification for each entry belong to planning and implementation. No arbitrary community-plugin directory is treated as verified native runtime support.

## Explicit Twilio addition

The owner additionally requested Twilio by name. Both official SMS guides document Twilio, so the inventory now labels both SMS entries explicitly and records provider search aliases. The [Twilio inventory section](channel-inventory.md#twilio--explicit-provider-coverage) links each runtime's SMS path, OpenClaw's separate voice plugin, Hermes's pinned optional telephony skill, and Twilio's own webhook/delivery documentation. These references have distinct capabilities and verification claims. FR-027–FR-028 and SC-008 make this explicit in setup and acceptance. No phone numbers were purchased and no messages or calls were made.

## Why credentials alone are insufficient

[OpenClaw Slack documentation](https://docs.openclaw.ai/channels/slack) distinguishes transport, tokens, app permissions and access policy. [Discord documentation](https://docs.openclaw.ai/channels/discord) separately guides bot setup, intents, invitations and identity/access configuration. [Teams setup](https://docs.openclaw.ai/channels/msteams) includes application/bot registration, credentials, a messaging endpoint and permissions. These are separate user decisions that the present token-only selection cannot replace.

[Hermes gateway documentation](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) explicitly distinguishes saved credentials from a running, connected gateway. Its version-specific platform guides are the authoritative starting point for each onboarding path. Current upstream instructions must still be checked against the pinned release before adopting them.

## NetClaw Comms and role placement

The owner clarified that existing NetClaw Twilio skills/MCPs and Zoom must be visible as **Comms**, and asked which claw owns them. Source inspection confirms:

- `twilio` already selects `twilio-mcp` and `twilio-voice-mcp`, plus four skills. The core registration uses the Twilio Labs MCP, restricted to call/message API tags. Its API-key credential contract differs from the native runtime SMS channel's auth-token contract.
- `zoom-rtms` already selects `zoom-rtms-mcp` and `zoom-meeting-context`. It is a meeting-input/context integration, not a native channel choice. The live question extractor connects to the Border; historical meeting search is a separate connector.
- [Plan validation](../../scripts/lib/setup_plan.py) excludes both full components from `BORDER_COMPONENTS` and rejects them with `border_domain_capability`. Focused claws and members can select the components. Neither appears in a current member preset; preset-only discovery therefore hides the intended use.
- Twelve pure draft-validation cases across both harnesses, three roles and two components confirmed Focused/member acceptance and exactly the Border rejection above. Synthetic Risk cases included a Border and member with matching Risk verification. See [investigation.json](investigation.json). These tests neither instantiated an MCP nor proved live compatibility.
- [Zoom's Border listener](../../mcp-servers/protocol-mcp/bgp/federation/zoom_channel.py) binds loopback. Its [client](../../mcp-servers/zoom-rtms-mcp/zoom_channel_client.py) expects the matching local port/secret. Thus accepting a member component is insufficient to establish its meeting-input connection: setup needs an explicit compatible placement. Opening that private listener remotely is not an installer workaround.
- [Twilio's webhook server](../../mcp-servers/twilio-voice-mcp/webhook_server.py) contains OpenClaw-gateway assumptions and a fallback model path; its [context manager](../../mcp-servers/twilio-voice-mcp/context_manager.py) uses an OpenClaw home path. These historical defaults must be reconciled with selected-installation ownership before claiming either runtime ready. This investigation did not invoke them.
- Zoom's server can start background services alongside MCP startup. Discovery is therefore not automatically effect-free; installer verification must account for the actual startup contract without beginning meeting capture or investigations.

**Specification decision:** conversation ingress remains Border/Focused-owned; separately selected Comms tools can be member/Focused-owned. The user-facing Comms view cross-links these paths, their credentials and readiness. The existing full-component Border restriction is preserved; planning must define the owned ingress-service placement rather than silently adding broad tool authority to the Border. No new calling/meeting operational behavior is requested.

Vendor references: [Twilio Labs MCP](https://github.com/twilio-labs/mcp), [Zoom RTMS setup](https://developers.zoom.us/docs/rtms/meetings/getting-started/), [Zoom MCP authentication](https://developers.zoom.us/docs/mcp/servers/). Current vendor support does not automatically qualify NetClaw's historical connector or its pinned runtimes.

## Decisions for this specification

1. Extend the existing setup step with complete runtime-specific discovery, multi-channel selections, guided prerequisites, private account binding, access policy and owned messaging services.
2. Carry all documented choices into planning. A reviewed native handoff is acceptable where a stable automated interface does not exist, but it must verify the selected installation's outcome. Unimplemented adapters remain open work.
3. Preserve distinct meanings for configured, authenticated, connected, inbound verified and outbound verified. No broad model or domain-operation retest is needed to assess installer configuration.
4. Do not send channel messages, configure cloud resources, start public listeners or use owner credentials during this investigation. Future external verification retains exact native consent.
5. Keep Webex compatibility explicit. Do not infer support from a vendor's bot API or from another runtime's catalog.
6. Leave source/runtime versions unchanged while specifying. A required runtime/plugin update must be evaluated and reviewed during planning.

## Numbering and workflow

[Issue303](https://github.com/automateyournetwork/netclaw/issues/303) proposes Spec154 for RuleHawk. To avoid that collision, this feature is **155-border-channel-setup**. The mandatory Spec Kit branch hook initially selected 154 from repository refs; the new local branch was immediately renamed to 155 before any specification directory was created. No RuleHawk files, branches, issues or PRs were changed.

The current task produces the specification, source investigation, full reference inventory and requirements checklist. Implementation design and task breakdown remain the next Spec Kit stages. No release version bump, PR, publication or live channel setup is part of this draft.

## SDD planning decisions — 2026-10-25

The owner ratified implementation and isolated installer qualification. Two read-only research agents were used as directed by the Spec Kit planning skill; neither changed files, read credentials or operated services.

### D1 — Preserve the engine and legacy plan shape

**Decision:** retain schema-1 channel selections and one account per platform/home; extend typed metadata, bounded capacities, effect identity and observations additively.

**Rationale:** multiple distinct channels already fit the model. Unrequested same-platform account multiplicity would conflict with Hermes's global environment contract. Canonical plan IDs must map to native underscore IDs.

**Alternatives considered:** replace the installer or introduce a second secret store; rejected because existing owned writers, native review, recovery and report projection already supply the needed foundation.

### D2 — Determine compatibility from pinned source, not index omissions

**Decision:** inspect source/plugin catalogs before assigning a version restriction. ClickClack and WeCom exist at the pinned OpenClaw revision despite omissions from its channel index. A2A, Buzz, Reef and X were not found as pinned channel entries and require an explicit compatible baseline before activation.

**Rationale:** an incomplete documentation index is not proof of missing runtime support. Current package tags must not be installed blindly against the older baseline.

**Sources:** [pinned external catalog](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/scripts/lib/official-external-channel-catalog.json), [pinned CLI](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/docs/cli/channels.md).

**Alternatives considered:** label all six index omissions unsupported; rejected as inaccurate. Upgrade every installation automatically; rejected because documentation discovery does not authorize a runtime baseline change.

### D3 — Native wizard entry points need bounded adapters

**Decision:** provide typed setup or an audited selected-platform native helper; never equate a generic CLI wizard exit with complete onboarding.

**Rationale:** OpenClaw's `channels add --channel` selects its flag-driven path rather than secret prompts. Hermes `gateway setup` has no single-platform option and its outer flow can install/start services. Its registry also contains options whose fallback merely prints environment instructions. Manifest metadata needs supplements: SMS requires a public webhook URL that its plugin manifest does not declare.

**Sources:** [Hermes platform registry](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/gateway/platform_registry.py), [Hermes gateway CLI](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/subcommands/gateway.py).

**Alternatives considered:** invoke broad native setup directly; rejected until its actual effect scope can be bounded and read back. Pass secret flags; rejected because native credential entry must not become OS command arguments.

### D4 — Distinguish Hermes configuration from transport

**Decision:** use the pinned foreground `hermes gateway run` through the existing owned service framework. Observe fresh selected-home gateway process/status evidence separately from saved platform configuration.

**Rationale:** `get_connected_platforms()` identifies configured/enabled platforms, not connected sockets. The runtime status file includes process, heartbeat and platform state. Native global service installation/profile migration is unnecessary.

**Sources:** [CLI contract](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/website/docs/reference/cli-commands.md), [status implementation](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/gateway/status.py).

### D5 — Reuse existing Comms operations with safe setup contracts

**Decision:** retain full Twilio/Zoom MCP eligibility on member/Focused claws. Add transient inert Zoom discovery and an explicitly owned same-host Zoom-to-Border binding, using dedicated connection material. Keep one actual Zoom process for tools and background meeting state.

**Rationale:** Zoom starts background services during import and shares an in-memory registry across its tools/listeners. A detached sidecar with a separate registry would break existing behavior. Continuous ingress must be qualified against actual native process lifetime, not inferred from registration. The Border's loopback bridge must remain private.

**Alternatives considered:** broaden Border domain-tool permissions or expose the bridge remotely; rejected. Add a second independent Zoom process; rejected. Introduce a new HTTP MCP daemon before proving it necessary; deferred because it adds transport/authentication/lifecycle scope.

**Decision:** replace managed Twilio core secret-argv registration with an owned environment-auth launcher pinned to `@twilio-alpha/mcp@0.7.0` and a complete dependency lock. Import its server class directly, preserving call/message service filters; do not import the auto-start CLI entry point.

**Rationale:** the published artifact exposes `build/server.js` and its server class. The package's CLI only consumes argument credentials. Published git head: `64c0f059d3cdc8f0e6fd796a1f76d872f78a1c2c`; integrity: `sha512-YsUde1pMXwqHm8Cvq9JdtsyvclVCC/f/V+FmxTNN04u5Qt5aapkbQgcfqBYQ0xcmvATBNswgPDo3MPVaCtZK8Q==`.

**Sources:** [Twilio server class](https://github.com/twilio-labs/mcp/blob/64c0f059d3cdc8f0e6fd796a1f76d872f78a1c2c/packages/mcp/src/server.ts), [CLI entry point](https://github.com/twilio-labs/mcp/blob/64c0f059d3cdc8f0e6fd796a1f76d872f78a1c2c/packages/mcp/src/main.ts).

Managed inbound voice additionally needs fail-closed selected-runtime routing and owned memory configuration: existing fallback paths can invoke a model or basic operational commands, and a default memory endpoint can address another local installation. Existing isolated HOME already contains legacy voice-context paths; no global path migration is needed.

### D6 — Treat mixed event/tool plugins honestly

**Decision:** preserve a capability-kind/role distinction for integrations such as Hermes Home Assistant rather than automatically attaching them as ordinary Border chat.

**Rationale:** its documented credential activates event ingress and device-control tools together. Discoverability is required; activation requires the appropriate explicit owner/permission contract.

**Source:** [pinned Home Assistant guide](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/website/docs/user-guide/messaging/homeassistant.md).

### D7 — Use local credential presence without exporting values

**Decision:** source work uses no credentials. The owner requested inspection of this Mac before requesting sandbox material; a private presence-only inventory was recorded outside versioned artifacts. Zoom setup fields and the RTMS package are present locally; no authentication or activation was attempted. Additional account-specific prerequisites remain conditional on the selected setup path.

**Rationale:** a complete `.env` export is unnecessary and would conflate unrelated installations/accounts. New setup retains native secret entry and private owner-bound storage. Dedicated test identities and exact external test review remain separate from credential presence.

### D8 — Bind native helper artifacts to exact upstream source

**Decision:** use typed forms where a stable documented configuration contract exists. For native prompts, implement version-checked selected-platform helpers and qualify their packaged artifacts; never guess hashed distribution filenames or use broad wizard defaults as scope enforcement.

For Hermes, the pinned helper can resolve an exact approved manifest, retain version/trust gates, load only that plugin and invoke its registered setup function. Built-in platforms have an exact setup-function/standard-field fallback. Do not sweep unrelated plugins or enter the outer service installer. Private callable seams require source/signature tests.

For OpenClaw, the pinned host source exposes a scoped plugin-registry loader, selected-adapter resolver and revision-aware commit driver. Public SDKs expose masked prompts but not the entire host driver. Build a reviewed helper artifact against the exact pinned host source for paths requiring native onboarding. Explicit plugin IDs prevent loader fallback to the configured plugin set; validate configuration deltas and selected post-write hooks before committing. If the source-bound artifact cannot be qualified, that path remains an open implementation gate rather than falling back to unbounded native setup.

**Sources:** [OpenClaw scoped setup loader](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/src/commands/channel-setup/plugin-install.ts), [adapter resolver](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/src/commands/channel-setup/registry.ts), [Hermes setup dispatcher](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/gateway_setup_wizard.py), [manifest parsing](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/plugins_manifest.py), [plugin gates](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/hermes_cli/plugins_discovery.py).

**Alternatives considered:** `channels add --channel` with secret flags; unrestricted native wizards; guessed package-internal chunk imports; importing all Hermes plugins. Rejected because each loses either credential, effect-scope or reproducibility guarantees.

### D9 — Owner-supplied private test material

The owner subsequently supplied `env_exported` and its unpack script and explicitly authorized their use for testing while prohibiting Git tracking. Both inputs and the private extraction directory are excluded through `.git/info/exclude`. The reviewed extractor and independent inspection verified the archive checksum, all 467 file checksums, regular relative files and private 0700/0600 extraction permissions. Exported live state is not imported into new or running installations. Only selected provider credentials are consumed in-process for isolated tests; no whole-file sourcing or bulk environment merge is permitted.

Read-only checks authenticated Discord, Slack and Webex bots. Twilio account and phone-number metadata checks returned 401; the latter reported 70051, which does not distinguish invalid identity from insufficient permissions. No message, call, model turn, capture or gateway was started. Native Twilio SMS still lacks its distinct auth-token prerequisite. This supersedes D7's earlier credential-presence-only status, not its ownership constraints.
