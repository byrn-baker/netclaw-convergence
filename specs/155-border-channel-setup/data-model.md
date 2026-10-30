# Data model — Complete Comms Setup

## Comms catalog

A versioned, source-controlled `config/components/comms.json` describes options without credentials. It is validated independently and included in the setup review binding.

Each option has:

- A stable catalog ID, provider/display name, search aliases and capability kind: conversation channel, event/tool integration, voice integration, meeting integration, browser interface, relay or migration reference.
- Runtime-specific contracts containing native ID, pinned source/version evidence, supported host/role, dependency records, onboarding method, settings/access definitions, expected startup effects and readback method.
- Official documentation URLs and checked dates, distinct from immutable pinned-source references.
- An implementation disposition: implemented typed setup, implemented bounded native handoff, unavailable in selected baseline, incompatible dependency, host/role restriction, retired reference or incomplete adapter. Only implemented paths can become setup-ready after verification.
- Qualification observations separate from the implementation disposition; documentation does not create runtime evidence.

Hermes native IDs containing underscores are mapped from canonical hyphenated plan IDs. Current and pinned inventories retain their original names and distinctions. ClickClack and WeCom are present at the OpenClaw pin despite omissions from that pin's index.

## Channel selection and account ownership

Retain schema-1 `claw.channels` entries and their `id`/`settingKeys`. A selected platform represents one account in that claw's home. Distinct platforms can be selected concurrently. Duplicate-platform accounts remain rejected unless a future explicit contract supports them; do not silently alias them.

Settings continue to use `claw.settings` with typed non-secret values or owner-bound secret references. Per-channel access fields are registered catalog fields, not arbitrary config paths. A provider/account identifier and destination may be private even when it is not a secret; exported reports use anonymous stable references.

Existing empty/single-channel plans remain readable. Additive setup metadata must have documented defaults and cannot change the meaning of a previously reviewed plan. Increasing bounded array capacity is compatible; accepting previously invalid role or credential combinations is not implicit migration.

## Comms tool selection

Existing MCP tools are selected through `claw.capabilities.components` and skills, independently of `claw.channels`. Twilio and Zoom retain their existing component IDs and role validation. Provide an explicit Comms member selection/profile rather than forcing an unrelated role preset. Selected components are subject to ordinary dependency/settings/registration checks.

The same provider may have several Comms options. This is intentional: Twilio native SMS, optional native telephony, core API MCP and NetClaw Voice MCP use different setup/credential contracts. Shared values can be reused only within an explicitly reviewed owner binding; provider-name equality is not consent to copy credentials.

## Service placement binding

Where an integration attaches to a Border, a non-secret plan binding identifies the integration, service-owning claw, target Border and same-host constraint. Generated connection material is private and installation-scoped. A Zoom binding reserves the local bridge port and creates a dedicated secret for the pair; it does not reuse enrollment, mesh, gateway or model-provider tokens.

One actual Zoom process owns its MCP tool state and background meeting services. A transient inert discovery process cannot be treated as the active process. Starting a separate sidecar with a different in-memory meeting registry is invalid unless an explicit tested state/transport contract is added.

No binding may open the existing loopback bridge remotely. A remote/incompatible placement has an explicit unresolved result.

The additive top-level `commsBindings` array defaults to empty. Each entry is exactly `{id, integration: "zoom", owner, border, port}`. IDs use the existing canonical ID grammar; owner and border reference different claws in the same Risk plan, and port is an otherwise unused loopback port. The owner must select `zoom-rtms`; the target must be that plan's Border. No address, command, credential or runtime path can be supplied by this binding. Generated material belongs to the binding's two owned homes.

## Setup effect

Extend the existing journal effect record with deterministic channel/Comms identity while preserving the existing owner/phase/component/state projection. An effect binds:

- Plan hash, source identity, Comms catalog hash and owning installation.
- Fixed adapter action and selected channel/integration ID; never arbitrary executable text supplied by a plan.
- Expected files/config revisions, dependency identity and reviewed external/startup effects.
- Native-review result, process identity, write intent and postcondition evidence.

A configuration or handoff effect can settle verified only after selected-home readback. Cancelled, incomplete or unknown outcomes prevent downstream service activation. Unknown effects are observed on explicit resume before another write is considered.

Channel effects use phase `comms`, ID `<owner>:comms:<canonical-channel-id>`, `channel` set to the canonical ID and `component: null`. Binding effects use phase `comms-binding`, ID `<owner>:comms-binding:<binding-id>` and a `binding` field. Both phases follow registration/identity and precede risk/services/verification. Existing effect IDs remain unchanged. The manifest describes only fixed adapters; plans cannot supply adapters or action names.

## Channel readiness observation

Each selected surface has independently recorded dimensions:

| Dimension | Meaning |
| --- | --- |
| Configuration | Expected owned settings, dependencies and access policy are present and valid. |
| Authentication | A specifically scoped provider/auth check succeeded. |
| Transport | The owned process reports a fresh authenticated connection or reachable authenticated ingress. |
| Inbound | A reviewed controlled ingress check was observed without implicit model/tool execution. |
| Outbound | A reviewed send has evidence at the stated provider/delivery level. |

Each dimension stores state, allowlisted reason code, observation time, checker, installation/account reference and private evidence reference. Applicable states include verified, unverified, configuration-required, skipped, failed, cancelled, blocked and unknown. An unsupported direction is distinguished from an unperformed test.

The existing tier summary is derived from these observations; it does not discard them. Public reports project only known IDs/enums/counts/times and anonymized owner/account references. Raw CLI output, errors, tokens, destination addresses and credential hashes are excluded. Detailed local exports remain explicitly reviewed and still exclude secrets.

## Verification request and attempt

A request identifies owner, channel/surface, direction and a native destination reference. The destination's actual value and exact content are shown only in the native review. Existing outbound-only requests normalize without changing intent.

`verification.channelTests[].direction` is an optional enum `inbound | outbound`, defaulting to `outbound` for legacy plans. Direction participates in deduplication and review. `claw.channels` and channel-test capacities become 64. No credential or destination content is added to these records.

An attempt records its nonce, scope hash, start time, outcome and private receipt reference before an external effect can occur. Twilio submission acceptance is not delivery; asynchronous callbacks/poll results must match the selected sender/account/message. Unknown sends or calls are never automatically replayed. Duplicate/out-of-order callbacks cannot regress or fabricate final evidence.

## Coverage record

Every inventory option is mapped to implementation, version/host/role disposition, local test evidence and actual provider/platform evidence. Missing test accounts are qualification gaps, not implementation success or upstream incompatibility. This record supplies the final completion denominator.
