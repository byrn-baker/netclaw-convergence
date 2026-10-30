# Feature Specification: Complete Comms Setup

**Feature Branch**: `155-border-channel-setup`
**Created**: 2026-10-25
**Status**: Ratified for SDD implementation on 2026-10-25 — implementation in progress

**Owner qualification scope, 2026-10-25:** This work tests the installer, not previously tested operational capabilities. The owner explicitly excluded real Twilio use and key reset. Twilio installer contracts must pass isolated credential/ownership/registration/startup/failure tests; live authentication, SMS, MMS and calls remain marked unverified and are not required for this installer acceptance. No simulated result may be described as live evidence. Disposable Azure/Teams prerequisite creation is authorized for setup testing, with separate private credentials and cleanup inventory.
**Input**: Investigate whether the VS Code installer chooses and sets up Border communication channels, including Slack, Teams, Discord and Webex; add a final setup spec for the gaps. Subsequent direction: reference **all** channels OpenClaw and Hermes respectively support using their documentation. Additional direction: explicitly include **Twilio**, account for NetClaw's existing Twilio skills/MCPs and **Zoom**, and make them visible as **Comms** with clear Border/member ownership.

The installer presents **Comms** as the common discovery area for conversation channels, calling/messaging tools and meeting integrations. Each entry explains its purpose, owning claw, prerequisites and observed state. This presentation does not merge their permissions, credentials or activation paths. See the [NetClaw role findings](research.md#netclaw-comms-and-role-placement).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Discover every channel for the selected runtime (Priority: P1)

An operator setting up a new Risk sees all documented communication options for the Border's selected runtime, understands their prerequisites, and chooses one or more. A Focused claw offers the same operator-facing flow. The catalog is complete for each runtime rather than a short list shared indiscriminately between them.

**Why this priority**: The released installer offers only three usable token-based choices, omits Teams and many other documented options, and blocks Webex. An absent choice must not imply that the runtime lacks the capability.

**Independent Test**: Compare the visible and assistant-readable choices against the dated [channel inventory](channel-inventory.md) and the documentation for the selected runtime version, without entering credentials or installing anything.

**Acceptance Scenarios**:

1. **Given** either supported Border runtime, **when** the operator opens Communication channels, **then** every applicable documented channel has a searchable entry with its official guide and an explicit setup/compatibility state.
2. **Given** the full documented inventory, **when** a channel needs a plugin, a particular host, an external service or a different runtime version, **then** the reason and prerequisites appear before credential entry; the installer never silently upgrades or substitutes another channel.
3. **Given** a selected channel, **when** the operator adds a second, **then** both selections and their independent settings survive; removing one preserves credentials/settings still used by another selection.
4. **Given** a Risk member, **when** the operator views its configuration, **then** Border conversation-channel credentials and controls are not assigned to that member; separately selected Comms tools retain their own member-owned credentials and permissions.
5. **Given** no messaging is wanted, **when** the operator explicitly chooses None / VS Code and HUD only, **then** setup remains available and reports messaging as intentionally omitted.
6. **Given** an agent protocol, browser interface, relay, event listener or voice integration, **when** it appears, **then** its purpose and effects are distinguished from a human chat channel. A runtime-specific retired option links its migration guidance.
7. **Given** a search for Twilio, **when** either runtime is selected, **then** its SMS option is discoverable by provider name, with separately identified voice/telephony options and version-specific limits; the operator does not need to know the runtime's internal channel identifier.

### User Story 2 — Complete channel onboarding with clear instructions (Priority: P1)

For each chosen channel, the operator follows a guided path from an unconfigured account to installation-scoped channel configuration. The path explains account/app creation, credentials or pairing, required permissions, approved users and destinations, connectivity, optional dependencies and any administrator action.

**Why this priority**: Saving a token does not configure workspace permissions, room access, plugin dependencies, pairing or a reachable inbound endpoint.

**Independent Test**: Use isolated installation homes and synthetic provider/admin responses to exercise each documented onboarding contract; verify exact written configuration and cancellation without sending messages or invoking a model.

**Acceptance Scenarios**:

1. **Given** Slack, Teams, Discord, Webex or Twilio, **when** onboarding starts, **then** the operator receives the correct runtime/version-specific app or bot instructions, minimum permissions, account identifiers, access choices and transport requirements instead of only a credential prompt.
2. **Given** another documented channel, **when** selected, **then** the same guided contract covers its actual authentication method: token, account login, pairing, browser consent, client identity, certificates or an explicitly reviewed native setup handoff as appropriate.
3. **Given** required tenant/admin approval or a separate service, **when** it is unavailable, **then** the channel remains incomplete with an actionable next step. A guide link alone is not successful configuration.
4. **Given** credentials for another claw exist on the host, **when** configuring this Border, **then** those credentials are neither borrowed nor exposed; secret entry stays in native inputs and the selected installation's private storage.
5. **Given** onboarding is cancelled or fails halfway, **when** resumed, **then** verified completed steps remain attributable and unknown external outcomes are reconciled before any retry.
6. **Given** a native handoff is required, **when** it finishes, **then** the installer reads back and verifies the selected installation's resulting configuration; a successful exit or dismissed prompt alone is insufficient.
7. **Given** Twilio SMS setup, **when** onboarding is reviewed, **then** the operator sees the owning account, sender capability, private credentials, approved recipients, authenticated callback and applicable provider prerequisites. Optional voice setup remains separately selected; changing one route does not overwrite the other or purchase a number implicitly.

### User Story 3 — Start the correct messaging service with explicit access (Priority: P1)

The installer configures and starts the messaging process owned by the new Border, with the chosen channels and access restrictions. It distinguishes that process from the HUD companion and federation services.

**Why this priority**: Current Hermes setup provisions HUD/federation services but no native messaging gateway. OpenClaw currently writes an allowlist policy without guiding the operator through the allowed users and rooms.

**Independent Test**: Install into isolated homes on supported Mac and WSL hosts; inspect native service ownership, effective channel configuration and authenticated transport status with controlled endpoints. Neighboring runtimes must remain unchanged.

**Acceptance Scenarios**:

1. **Given** a Hermes Border with messaging selected, **when** setup starts its services, **then** an installation-owned messaging gateway runs and reports the selected platforms separately from the HUD companion.
2. **Given** OpenClaw requires a channel plugin, **when** the plan is reviewed, **then** its source/version, dependencies, activation and any restart are disclosed and subsequently verified for that Border.
3. **Given** groups or direct messages are enabled, **when** configuration is reviewed, **then** the operator sees the exact account, approved users/rooms, pairing and mention policy. Empty access scope remains incomplete; it never becomes unrestricted access.
4. **Given** an inbound public endpoint is required, **when** setup is reviewed, **then** the listener, authenticated transport, exposure and reachability requirements are explicit. No tunnel, firewall change or public listener is silently introduced.
5. **Given** another installation or bot-account consumer is already active, **when** a conflict is detected, **then** setup explains the ownership conflict and does not stop, adopt or reconfigure it.

### User Story 4 — Verify and report channel readiness honestly (Priority: P1)

The operator can distinguish saved configuration, valid credentials, connected transport, permitted inbound delivery and confirmed outbound delivery. Optional tests are tied to a specific channel account, destination and message.

**Why this priority**: Runtime/HUD readiness and a saved token are not evidence that a user can reach the Border through a channel. The current wizard's optional channel tier does not populate its channel-test selections.

**Independent Test**: Select verification in the native wizard, cancel or approve individual synthetic checks, and inspect separate results for every selected channel. Test unknown outcomes and confirm that no message or model turn occurs without its required review.

**Acceptance Scenarios**:

1. **Given** several selected channels, **when** channel verification is enabled, **then** the operator chooses an exact account and destination for each requested check, and those choices are actually carried into the reviewed run.
2. **Given** a proposed outbound test, **when** the operator cancels its native review, **then** no message is sent. Approval covers only the displayed destination, sender identity and fixed test content.
3. **Given** transport is connected but no inbound challenge or outbound receipt has been observed, **when** the report is displayed, **then** those directions remain unverified independently.
4. **Given** a receipt is lost after a possible send, **when** setup resumes, **then** the outcome remains unknown and is not automatically resent.
5. **Given** the user chooses no external tests, **when** installation finishes, **then** the report can show local configuration complete while clearly retaining unverified delivery; it must not claim complete channel readiness.
6. **Given** an inbound verification method would invoke the model or domain tools, **when** selected, **then** that additional effect requires its own review or the test stays unverified. Installer qualification uses controlled transport checks and does not retest operational capabilities.
7. **Given** a Twilio test returns an accepted or queued message identifier, **when** evidence is reported, **then** submission and final delivery remain distinct. An invalid callback signature, missing delivery result or failed delivery cannot become a successful delivery claim, and a voice call is never used as an automatic SMS setup check.

### User Story 5 — Keep every setup frontend consistent and recoverable (Priority: P2)

The wizard, CLI and assistant guidance describe the same runtime-specific choices, missing requirements, review boundaries and readiness. An interrupted installation can resume without losing channel choices or duplicating cloud-side actions.

**Why this priority**: A complete wizard cannot rely on hand-editing a plan or different semantics in another frontend.

**Independent Test**: Produce equivalent plans through each frontend, reload the owning editor and resume an interrupted run. Compare selected accounts, effect reviews and redacted results.

**Acceptance Scenarios**:

1. **Given** the same channel intent, **when** drafted by wizard, CLI or assistant, **then** the resolved runtime, accounts, permissions and verification requests agree.
2. **Given** an assistant proposes setup, **when** credentials or effects are needed, **then** it stages native inputs/review without retrieving secrets or bypassing approval.
3. **Given** an old single-channel or no-channel plan, **when** opened, **then** existing choices remain understandable and compatible, or an explicit reviewed migration explains the required change.
4. **Given** cleanup is requested, **when** reviewed, **then** only installation-owned local artifacts are eligible; shared accounts, apps, rooms, remote messages and neighboring services remain untouched unless a separate specifically authorized workflow covers them.

### User Story 6 — Find Twilio and Zoom under Comms and understand their owner (Priority: P1)

An operator sees that NetClaw already offers Twilio and Zoom, understands what each integration does, and can set up the appropriate capability on an eligible claw without confusing a tool with a Border conversation channel.

**Why this priority**: Both components and their skills already exist, but they are outside the channel choices. Current validation allows them on a Focused claw or member and rejects their full MCP bundles on a Border. Zoom also has a distinct Border-facing meeting-input path that needs an explicit deployment contract.

**Independent Test**: Search Comms in wizard, CLI and assistant discovery for Twilio and Zoom; inspect role-specific choices and draft plans without activating services or calling tools. Test Border ingress ownership separately from member tool ownership.

**Acceptance Scenarios**:

1. **Given** either runtime, **when** the operator searches Comms for Twilio, **then** they can distinguish the runtime SMS channel, optional runtime telephony path, NetClaw core Twilio MCP and NetClaw Voice MCP with its four existing skills. Catalog presence and actual setup readiness are separately visible.
2. **Given** a member or Focused claw, **when** Twilio tools are selected, **then** its own credentials, skills and permissions bind to that claw; it does not inherit Border channel credentials or gain unrequested conversation ingress.
3. **Given** a Border, **when** a full Twilio or Zoom MCP component is ineligible under its role contract, **then** Comms still explains the option and offers an eligible setup path or a specific unresolved placement result. The installer does not silently broaden the Border's tool permissions.
4. **Given** Zoom is selected, **when** setup is reviewed, **then** it distinguishes meeting input/RTMS, the panel, historical-meeting tools and their connection to the Border. It identifies the selected service owner, required host relationship and each unresolved dependency without claiming a generic native chat channel.
5. **Given** a required member capability is not represented by a preset, **when** the operator selects it through Comms, **then** guided setup can produce a valid explicit capability selection without a hand-edited plan or an unrelated member profile masquerading as a Comms profile.
6. **Given** the Zoom bridge requires local placement with the Border, **when** the proposed installation cannot meet that requirement, **then** setup identifies the missing placement/binding rather than opening the loopback service remotely or claiming success.
7. **Given** Comms discovery or local verification, **when** inspecting options, **then** it does not start meeting capture, background ingestion, calls, messages or a model session. Any activation effects are separately reviewed and attributable.

### Edge Cases

- A channel is documented by one runtime but not the other; current documentation differs from the selected pinned version.
- A channel was renamed, removed, moved into a plugin, or has several distinct transports or account types.
- A plugin is installed but incompatible, disabled, missing dependencies or unable to start.
- An app token is valid but belongs to the wrong workspace/tenant; required scopes, intents or admin consent are missing.
- Pairing expires, an allowlisted room is removed, a bot is not invited, or a QR code/login session must be renewed.
- A token exists but the messaging gateway is stopped; a HUD health check succeeds while the channel is disconnected.
- Multiple selected accounts share a required field; changing one must not discard another account's settings.
- A channel automatically emits join/startup/recovery notices, runs scheduled work or consumes pending events on startup.
- Another process uses the same bot account; no broad process-name or port-based termination is allowed.
- A webhook points elsewhere, has incorrect authentication, or a local callback is unreachable from the provider.
- Partial success across several channels; expired credentials; rate limiting; provider downtime; an unknown send outcome.
- A host-specific option such as an Apple messaging bridge is selected on an incompatible host.
- A reference concerns meetings, voice, browser access, agent protocols or event ingestion rather than ordinary bidirectional chat.
- The same provider appears as a native channel, optional runtime plugin/skill and NetClaw MCP component, each with different ownership and credential contracts.
- Zoom MCP discovery would start background services; its local Border bridge is unavailable or resides on another host; its historical connector is not configured.
- A Twilio sender lacks the selected SMS/MMS/voice capability; provider account restrictions prevent delivery; SMS and voice share a number but have different callbacks.
- Twilio callbacks are duplicated, delayed, out of order or have an invalid signature; credentials authenticate but no final delivery is observed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Setup MUST present a Comms area containing a dedicated Communication channels step for a new Border or Focused claw, supporting explicit None and one or more channel selections without overwriting previous selections.
- **FR-002**: Catalog coverage MUST include **all** channels documented for OpenClaw and Hermes separately, using [channel-inventory.md](channel-inventory.md) and [channel-inventory.json](channel-inventory.json) as the dated starting reference. The four originally named channels are not the scope ceiling.
- **FR-003**: Each entry MUST identify its runtime, documentation URL/date/version, channel/account type, host constraints, plugin/dependency status, supported authentication paths, access controls, connectivity requirements and available verification evidence. A missing implementation MUST be labelled as such, not falsely attributed to the upstream runtime.
- **FR-004**: Current upstream documentation, pinned-version support, installed capability and actual readiness MUST remain distinct. Selecting a newer-only option MUST require an explicitly reviewed compatible baseline; no automatic runtime upgrade, cross-runtime substitution or silent removal is permitted.
- **FR-005**: Plugin, browser, relay, telephony, event-ingress, agent-protocol and retired/migration entries MUST retain their documented distinctions. Additional linked interfaces MUST be discoverable in context without inflating counts of bidirectional human-chat channels.
- **FR-006**: Webex MUST remain explicitly tracked even though it is absent from the current upstream indexes. The existing incompatible plugin MUST not be enabled until a compatible integration is qualified. Unsupported Hermes Webex support MUST not be invented.
- **FR-007**: Each compatible channel MUST offer guided setup or a reviewed, installation-scoped native handoff that covers its actual prerequisites and verifies the resulting configuration. A documentation-only card cannot close an implementation task for a supported channel.
- **FR-008**: App/account creation, administrator consent and provider-side resources MUST be described with minimum privileges and exact ownership. Such external changes require a specific reviewed scope; unperformed manual steps remain incomplete.
- **FR-009**: Secret entry MUST use native secure prompts or supported native login/pairing flows, be bound to the selected account and installation, and remain absent from plans, assistant context, ordinary logs and exported reports. Existing private writers and structural redaction requirements remain in force.
- **FR-010**: Conversation-channel accounts MUST belong to the Border or Focused claw; members MUST not receive those channel credentials or become unintended ingress points. Separately selected Comms MCP/tool capabilities may have their own member-owned credentials under the existing role rules. This feature MUST preserve existing routing, mesh identities, certificates, budgets and shared security policy.
- **FR-011**: Setup MUST guide explicit user/room scope, direct-message pairing and mention policy where supported. Missing scope MUST not be converted to broad access. The review MUST make the effective policy understandable before activation.
- **FR-012**: All selected channel dependencies and plugins MUST be acquired, activated and verified within the reviewed installation scope. Partial installation, incompatible plugins or unknown native outcomes MUST not produce success.
- **FR-013**: Setup MUST start and observe the owned messaging process for the selected runtime, including Hermes when channels are selected. HUD/companion and federation health MUST not substitute for messaging-gateway health.
- **FR-014**: Service names, credentials, environment, ports and lifecycle actions MUST bind to the selected home and account. Duplicate consumers and ownership conflicts MUST be reported without adopting or terminating unrelated processes.
- **FR-015**: Public listeners, callback URLs, tunnels and network exposure MUST be individually disclosed and reviewed. Setup MUST verify required authentication and reachability or retain an explicit incomplete state.
- **FR-016**: Automatic integration effects such as introductions, startup notices, recovery sends, meeting capture, background listeners and pending-event consumption MUST be suppressed during isolated qualification or explicitly included in the operator's reviewed activation scope. If the adapter cannot bound them, activation MUST remain blocked with a reason.
- **FR-017**: The installer MUST record per-channel states for draft, local configuration, authentication, transport connection, inbound verification and outbound verification, plus blocked, cancelled, skipped, failed and unknown outcomes. Evidence MUST include the owning installation/account and observation time without exporting secrets or private destinations by default.
- **FR-018**: Selecting channel tests in the wizard MUST materialize real account/destination test requests. CLI and assistant drafting MUST obey the same validation and evidence rules; hand-editing a plan MUST not be necessary.
- **FR-019**: Each external test message MUST require explicit native review of its sender, destination and content. A possible send with no conclusive receipt MUST remain unknown and MUST not be silently replayed.
- **FR-020**: Inbound and outbound verification MUST remain separate. A model/provider turn, device operation, domain tool or coordinated network window MUST not be used implicitly to prove channel setup.
- **FR-021**: A caller may skip optional external tests, but selected channels MUST not be called fully ready unless the stated readiness checks actually passed. Runtime readiness and channel readiness MUST be reported separately.
- **FR-022**: Cancellation, editor closure, restart and explicit resume MUST preserve choices and verified checkpoints, inspect unknown outcomes, and require renewed review when the plan or permissions change. Cleanup MUST preserve shared or externally owned resources.
- **FR-023**: Existing no-channel and single-channel plans MUST remain compatible or receive an explicit, lossless reviewed migration. Previously installed claws MUST not be adopted or reconfigured by this new-installation workflow.
- **FR-024**: Wizard, CLI, assistant setup tools and deployment guidance MUST use consistent channel definitions and review boundaries. All cards and native dialogs MUST remain usable by keyboard and under existing theme, contrast and zoom requirements.
- **FR-025**: Qualification MUST cover catalog completeness, each onboarding contract, service ownership, policy refusal, privacy, interruption and verification behavior, followed by actual isolated installer evidence for every channel/harness combination claimed ready. Missing accounts or platforms MUST be reported as coverage gaps; simulated or documentation-only checks MUST not count as live passes.
- **FR-026**: Final completion MUST reconcile every inventory entry to a documented outcome. Unsupported host/version and retired entries require evidence; unfinished supported adapters remain open. No “all channels supported” or “100% complete” claim may rest on testing only a few platforms.

- **FR-027**: Twilio MUST be explicitly discoverable for both runtimes, with guided SMS setup and separately described optional voice/telephony setup. Setup MUST identify the account and sender, protect credentials, guide recipient access and authenticated callbacks, and track applicable provider prerequisites. SMS, MMS and voice support MUST be qualified independently for the selected runtime/version; a shared provider or number does not establish equivalent capabilities. Provisioning a paid number or changing an existing provider route requires its own reviewed action.
- **FR-028**: Twilio verification MUST distinguish authenticated configuration, accepted submission and observed delivery. Public callbacks MUST retain signature validation. Duplicate, out-of-order or unknown outcomes MUST not cause duplicate sends or false success. Texts, attachments and calls MUST each remain within explicit reviewed test scope; setup MUST not place calls or invoke a conversational model implicitly.

- **FR-029**: Setup MUST expose a searchable **Comms** area covering the full runtime channel inventory and existing NetClaw Twilio/Zoom components and skills. Each option MUST state whether it is conversation ingress, an outbound/account tool, voice or meeting integration, its eligible owner roles, runtime/version constraints, setup path and readiness. Multiple appearances of one provider MUST remain distinguishable and cross-linked.
- **FR-030**: Comms tool credentials MUST bind to their selected eligible member or Focused claw independently of Border ingress credentials. Setup MUST offer explicit guided capability selection even where no existing member preset includes the capability. Border ingress and any owned integration service MUST have a reviewed placement contract; the current rejection of full Twilio/Zoom MCP bundles on a Border MUST not be bypassed by a blanket permission change.
- **FR-031**: Zoom setup MUST reuse the existing NetClaw integration and explain its RTMS/app prerequisites, service ownership, local Border binding, panel and separately configured historical-meeting connector. Required dependencies and actual selected-runtime compatibility MUST be verified before readiness. Optional camera features or unavailable historical integration MUST have separate outcomes. Discovery and installer qualification MUST not start meeting capture or investigations implicitly.
- **FR-032**: Existing NetClaw Comms capabilities MUST be reused through their own documented credential, configuration and service contracts. Shared provider names MUST not cause native-channel secrets to be substituted for MCP/API credentials, duplicate activation, global-home writes or competing callbacks. Qualification MUST establish the installation binding for each selected surface without retesting its domain operations.

### Key Entities

- **Channel capability**: Runtime/version-specific documented option, type, dependencies, requirements, guide and qualification state.
- **Channel account binding**: Stable relationship between the selected Border/Focused installation, provider account and private credential references.
- **Channel access policy**: Explicit allowed users/destinations, direct-message pairing and mention behavior.
- **Onboarding checkpoint**: Reviewed local or external step, observed result, owner and safe-resume disposition.
- **Messaging service binding**: Installation-owned process/service identity and selected channel accounts, distinct from HUD and federation services.
- **Channel verification request/result**: Exact reviewed test scope and attributable authentication, connection or delivery evidence.
- **Comms option**: User-facing provider/capability entry cross-linking native channels, optional runtime interfaces and NetClaw tools with distinct owner roles and setup states.
- **Comms service placement**: Reviewed owning claw, local/remote service placement and authenticated Border attachment where applicable.
- **Coverage record**: One disposition per documented runtime/channel/version/host combination, with sources and actual test scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every entry in both dated runtime inventories and their related-interface references has a discoverable, documented disposition; comparison reports zero unexplained omissions.
- **SC-002**: Every channel claimed setup-ready completes its documented path from an empty installation home through saved configuration and observed service/transport readiness without undocumented manual file editing. Provider-admin steps are visibly tracked.
- **SC-003**: An operator can add two or more supported channels to one Border, remove one, cancel and resume, with all retained account settings preserved in every acceptance case.
- **SC-004**: All negative ownership, missing-permission, incompatible-plugin and wrong-account cases stop safely and identify the unresolved requirement; none are reported as successful.
- **SC-005**: Every claimed verified direction has matching evidence; no cancelled test sends a message, and no unknown send is automatically repeated in the acceptance matrix.
- **SC-006**: Privacy checks find zero secret values or unreviewed private identifiers in public reports, saved plans, assistant replies and UI persistence; neighbor installation state remains unchanged.
- **SC-007**: The final coverage report names every untested or unsupported combination explicitly and keeps installer outcomes separate from model, device and domain-operation qualification.

- **SC-008**: Searching for Twilio resolves the documented SMS path for either runtime and its distinct telephony references. Acceptance cases cover missing sender capability, invalid callback signatures, pending delivery, cancelled paid provisioning and shared-number route preservation; none produce a false readiness result or an unreviewed external effect.

- **SC-009**: Twilio and Zoom are discoverable through Comms in all setup frontends. Role-matrix acceptance covers both runtimes and Border/member/Focused choices, explicit member capability selection, independent credentials and incomplete local bindings; no entry disappears because it is not a native chat channel, and no selection silently grants additional Border tool authority.

## Assumptions

- This is the final Comms/setup follow-up to Spec153, not a rewrite of proven operational capabilities or a requalification of CML/viz operation routing, topology transfer or live network execution.
- The scope is new independent installations and safe continuation of their setup runs. General channel administration for arbitrary existing installations is separate work.
- Runtime-specific documented support governs the choices; a capability in one runtime does not establish support in the other. Current reference pages are not permission to upgrade the pinned runtime baseline.
- All documented compatible channels are included in planning. Implementation may sequence them, but completion cannot silently shrink the inventory to the original four examples.
- The operator supplies or creates external accounts and obtains tenant/admin consent where required. Paid accounts, public exposure and externally visible actions are not authorized by writing this spec.
- External message verification is optional and individually reviewed. This investigation/specification sends no messages, starts no models or devices, and changes no live runtime configuration.
- NetClaw Twilio and Zoom operations already exist. This feature makes them discoverable and completes installation ownership/onboarding; it does not rewrite calling, meeting intelligence or network-operation capabilities.
- Technical design, exact adapters and implementation tasks follow the normal Spec Kit planning phase. This draft does not assert that those changes are implemented or published.
