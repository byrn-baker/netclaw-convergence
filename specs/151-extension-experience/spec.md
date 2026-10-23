# Feature Specification: NetClaw Extension Experience

**Feature Branch**: `151-extension-experience`
**Created**: 2026-10-11
**Status**: Implemented and locally verified — distribution held
**Input**: Spec151 improves the entire VS Code extension's appearance and organization, using automateyournetwork.com as the visual reference. Preserve the liked blue buttons, search, filters and existing functionality. Explain connection inputs, replace bland text-heavy views with purposeful adaptive card layouts, expand configured-network inspection into testbed CRUD/import, and expose environment credentials and setup by MCP. Follow specify → at least five clarification questions → plan → tasks → analyze → resolve findings → implement. Do not package, push, deploy or publish until explicitly requested.

## Scope and Direction

The primary deliverable is a consistent, branded extension experience, with testbed inventory management, individual MCP configuration/setup, and the subsequently clarified security controls described in US6. MCP setup includes explicitly confirmed execution of supported installation, registration and restart actions. The scope includes every existing extension view, its labels, forms, loading/error/empty states, and navigation. The browser HUD is a supporting existing service; redesigning it is not assumed.

The visual reference is [Automate Your Network](https://automateyournetwork.com/), inspected on 2026-10-11. Its strong heading hierarchy, bordered feature cards, pink/cyan accents and restrained visualizations inform the extension. The extension automatically follows VS Code's current light, dark or high-contrast theme, adapting those brand elements instead of forcing the website's dark background. The existing blue primary actions remain recognizable. Card appearance does not require the Microsoft Adaptive Cards product or schema.

Spec150's identity binding, workspace trust, selected-runtime separation, explicit operation reviews, secret handling, request ownership and interruption semantics remain applicable. Inventory editing changes configuration records; it does not execute commands on devices or authorize network changes.

## Clarifications

### Session 2026-10-11

All five owner clarification questions are answered. The original instruction authorizes proceeding through planning, tasks, analysis, finding resolution and local implementation.

- Q: Should the extension default to the Automate Your Network dark visual identity, or automatically follow the VS Code theme? → A: B — automatically follow VS Code's light/dark theme, using the same branded cards, typography and accents, with high-contrast support.
- Q: How should users create and edit their testbed? → A: A — device cards and guided forms, plus an advanced YAML editor and file import/export.
- Q: Which file formats should testbed import/export support? → A: B — YAML (.yaml/.yml) and equivalent JSON, plus CSV for a documented subset of basic device inventory fields.
- Q: How far should setup inside each MCP card go? → A: C — per-MCP configuration and setup guidance, reviewed commands that can be staged in a terminal, and extension execution of supported installation, registration and restart actions after explicit confirmation.
- Q: How much imagery and 3D should the redesigned extension include? → A: A — custom branded imagery plus interactive 3D where useful, especially topology, with restrained motion elsewhere.

## User Scenarios & Testing *(mandatory)*

The stories below are all required. Priorities reflect implementation dependency and verification order; the owner supplied no ranking among requests.

### User Story 1 - Navigate a cohesive branded workbench (Priority: P1)

An operator opens NetClaw and immediately understands their selected installation, available actions, and current observations through readable headings, purposeful cards and consistent controls.

**Why this priority**: A shared visual language underpins the requested improvements across every view.

**Independent Test**: Open all existing views using representative local observations and check their layout, semantics, controls, keyboard operation and unavailable states.

**Acceptance Scenarios**:

1. **Given** a selected installation, **When** Overview opens, **Then** its identity, runtime, observed availability and useful next actions have distinct visual groups and plain-language explanations.
2. **Given** any existing view, **When** data loads, **Then** the primary presentation uses meaningful labels and grouped summaries; raw source fields are available as secondary detail where useful.
3. **Given** large inventories, long names or missing fields, **When** the operator searches and filters, **Then** the controls retain their functionality and results remain readable without implying missing data is healthy.
4. **Given** a narrow editor, keyboard navigation, high contrast or reduced motion, **When** the operator uses the extension, **Then** content remains usable, focus visible and critical state understandable without animation or color alone.
5. **Given** an open extension view, **When** the operator changes VS Code between light, dark and high-contrast themes, **Then** the view adapts automatically without losing its current draft, filters, selection or branded visual hierarchy.

### User Story 2 - Understand and complete connection setup (Priority: P1)

An operator adds an existing NetClaw without having to guess whether a connection label is a host, URL, account or identifier.

**Why this priority**: The owner identified a concrete first-use obstacle.

**Independent Test**: Add a synthetic local connection, cancel at each step, and verify the persisted profile and reviewed installation binding.

**Acceptance Scenarios**:

1. **Given** Add existing NetClaw, **When** a label is requested, **Then** instructions say it is a friendly name chosen by the operator and show examples such as “My Mac lab” and “WSL NetClaw.”
2. **Given** an API address is requested, **When** the operator reads the guidance, **Then** it explains that this is the running HUD API address on the current extension host and shows the usual local example.
3. **Given** an invalid address, unreachable service, untrusted workspace or changed identity, **When** connection fails, **Then** the message states the problem and next step without saving a false connected state.

### User Story 3 - Manage a pyATS testbed (Priority: P1)

An operator finds their configured devices in cards and can create, inspect, update or remove entries through guided forms. An advanced YAML editor supports detailed testbed configurations, and file import/export supports moving inventory into and out of the workbench. Every editing path identifies the target testbed and proposed changes clearly.

**Why this priority**: This is an explicitly requested functional extension to the present configured-network view.

**Independent Test**: Use an isolated representative testbed to exercise create/read/update/remove/import, invalid input, cancellation, conflicting edits, preservation and recovery; do not contact devices.

**Acceptance Scenarios**:

1. **Given** a selected testbed, **When** a device is added or edited, **Then** required values have labels, examples and actionable validation, and the operator reviews the resulting inventory change before saving.
2. **Given** existing devices and advanced testbed fields, **When** an unrelated device changes, **Then** unrelated inventory, credential references and supported advanced configuration are preserved.
3. **Given** a device removal, **When** it is confirmed, **Then** only the selected inventory entry is removed, recovery information is available, and no command is sent to the device.
4. **Given** an import file, **When** it is inspected, **Then** the interface shows validation results and affected devices before any write; malformed or unsupported files leave the destination unchanged.
5. **Given** the testbed changed after it was loaded, **When** a save is requested, **Then** the stale edit cannot silently overwrite newer content.
6. **Given** a testbed needing advanced configuration, **When** the operator opens the YAML editor, **Then** they can edit and validate the document with the same target identification, review, conflict detection and recovery protections as guided edits.
7. **Given** an unsaved form or YAML draft, **When** the operator changes editing mode, **Then** the draft is preserved or an explicit save/discard/cancel choice prevents silent loss; the saved inventory remains unchanged until a reviewed save.
8. **Given** a configured testbed, **When** the operator exports it, **Then** they choose a supported format and destination through an explicit export action, with credential handling explained before any secret-bearing output.
9. **Given** a YAML or JSON testbed document, **When** it is imported, **Then** the complete supported document structure is validated and previewed before a reviewed write.
10. **Given** a CSV device inventory, **When** it is imported or exported, **Then** the documented column mapping, per-row validation and limited inventory scope are clear; advanced fields are not silently discarded, and a CSV import preserves existing fields outside its supported columns.

### User Story 4 - Configure one MCP in context (Priority: P1)

An operator searches for an MCP, opens its card and finds the relevant setup information, configuration fields and secret presence without navigating an unrelated global picker. For supported installation, registration and restart actions, the operator can review and stage the existing command or explicitly confirm execution from the extension, then observe progress and verification.

**Why this priority**: It makes existing configuration accessible from the integration being managed and exposes remaining setup gaps honestly.

**Independent Test**: Use synthetic MCP configurations and an isolated installation to verify scoped editing, secret handling and confirmed setup execution, including cancellation, wrong-target prevention, partial failure and result verification. Do not modify the owner's live installation during development acceptance.

**Acceptance Scenarios**:

1. **Given** an MCP card, **When** Configure is selected, **Then** its documented fields are grouped with explanations, required/optional indicators, examples for non-secret values, and set/unset indicators for secrets.
2. **Given** a saved secret, **When** setup is opened, **Then** the existing secret is not exposed; leaving it unchanged, replacing it and clearing it are distinct actions.
3. **Given** a proposed configuration update, **When** it is reviewed, **Then** the selected installation, integration and changed fields are clear and unrelated settings remain intact.
4. **Given** a setting accepted by the configuration service, **When** the result is displayed, **Then** saved configuration, loaded runtime state and verified endpoint connectivity are distinguished.
5. **Given** incomplete integration metadata or an unavailable setup operation, **When** the card opens, **Then** it explains the limitation and provides applicable guidance rather than showing a nonfunctional action.
6. **Given** a supported installation, registration or restart action, **When** the operator requests it, **Then** the extension shows the target host, installation, integration, intended changes and any interruption before asking for explicit confirmation; cancellation makes no change.
7. **Given** a confirmed setup action on the same reviewed target, **When** execution begins, **Then** progress and sanitized results are visible, unrelated integrations are preserved, and success is reported only after the action's defined verification completes.
8. **Given** a changed target, insufficient permissions, interrupted execution or partial failure, **When** setup cannot be verified, **Then** the extension reports the actual outcome and recovery guidance without silently retrying or claiming success.

### User Story 5 - Use visuals that improve understanding (Priority: P2)

An operator encounters custom branded imagery and an interactive 3D topology view that support the workbench while preserving fast access to controls and records. Motion elsewhere is restrained; decoration does not compete with operational controls.

**Why this priority**: Visual treatments build on the shared layout and accurately modeled inventory.

**Independent Test**: Compare visual and accessible text presentations using synthetic data, reduced motion and an unavailable graphics renderer.

**Acceptance Scenarios**:

1. **Given** a network visualization, **When** devices and links are shown, **Then** their source and whether they are configured or observed are explicit; layout proximity never invents a network link.
2. **Given** graphics are disabled or unavailable, **When** the view opens, **Then** the same inventory and primary actions remain accessible.
3. **Given** generated brand artwork, **When** it is displayed, **Then** it contains no private network data or embedded functional text and does not masquerade as live topology or health evidence.

### Edge Cases

- Disconnected, unauthorized, unavailable, loading, empty, stale and failed observations remain distinct.
- Long labels, nested objects, large collections, empty strings and false/zero values remain meaningful and do not cause overflow or disappear as missing data.
- Identity changes or disconnects invalidate in-flight editing and late responses; switching installations must not apply the previous draft to a new target.
- Imports may contain duplicate devices, incompatible connections, credentials, aliases, unsupported tags or oversized documents; rejection must identify the issue without leaking secrets.
- CSV may contain quoted delimiters, missing or unknown columns, duplicate device IDs and spreadsheet formula-like values. Import/export must handle these explicitly without evaluating cells or presenting the flat inventory format as a complete testbed backup.
- Existing testbeds may contain comments, anchors, defaults, interfaces, links and custom fields. Editing must preserve unaffected data or explicitly refuse unsupported transformations.
- Read-only targets, failed saves, partial failures and concurrent edits require explicit outcomes and safe recovery without automatic replay.
- Unknown integration metadata must not be interpreted as “nothing to configure” or a working integration.
- MCPs may be on-demand processes without a persistent restart operation. Unsupported lifecycle actions must be identified, not approximated with unrelated service restarts. Active work, missing prerequisites, interrupted installs and partial registration require explicit outcomes.
- Existing credentials must never appear in audit output, generated images, diagnostic exports or source control.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All extension views MUST use a documented shared hierarchy for page title, description, status, sections, actions, cards, forms and supporting details.
- **FR-002**: Primary actions MUST retain the recognizable blue treatment; search, filtering and pagination MUST retain existing capabilities.
- **FR-003**: Domain views MUST present useful domain-specific summaries and labels instead of making recursive raw-field output their default primary experience.
- **FR-004**: Overview MUST prioritize the selected connection, runtime, observed status and next actions, using concise operator-facing text.
- **FR-005**: Connection setup MUST explain the chosen nickname, target API address and extension-host locality with examples and validation.
- **FR-006**: Inputs MUST have persistent labels, consistent spacing, contextual help, visible focus, and distinct validation and disabled states.
- **FR-007**: Cards MUST adapt to available width, keeping primary actions discoverable and detailed content progressively available.
- **FR-008**: The extension MUST automatically follow VS Code's active light, dark or high-contrast theme while retaining branded typography, card structure and adapted accent colors. Theme changes MUST update open views without resetting drafts, filters or selection; a separate forced-dark default is not used.
- **FR-009**: Keyboard-only use, high-contrast presentation and reduced motion MUST preserve all primary workflows. Text and control state MUST remain distinguishable without color alone.
- **FR-010**: Configured inventory and BGP/observed topology MUST have distinct names, source labels and explanations.
- **FR-011**: Testbed management MUST provide device cards and guided forms for creating, reading, updating and removing entries, an advanced YAML editor, and supported file import/export. Both editing modes MUST preserve unsaved work or require an explicit save/discard/cancel decision when switching; imports MUST provide previews and validation.
- **FR-012**: Testbed edits MUST identify the destination, require explicit save/review, preserve unaffected data, detect stale changes and provide recovery from an unsuccessful write.
- **FR-013**: Import/export MUST support complete testbed YAML (.yaml/.yml), equivalent JSON, and CSV for a documented subset of basic device inventory fields. Merge/replacement behavior and device-ID conflicts MUST be explicit in the preview. CSV MUST provide column documentation and row-level validation, preserve existing fields outside its supported columns on import, and explain omitted advanced data on export; it MUST NOT imply full-testbed fidelity. Export MUST be an explicit action with a chosen destination and clear credential handling.
- **FR-014**: Testbed credential references MUST be preserved. Existing secret values MUST not be displayed in ordinary cards, reviews, logs or diagnostics.
- **FR-015**: Inventory edits MUST NOT initiate device connections, execute commands, start collectors, alter device authorization or change production change-control rules.
- **FR-016**: Every MCP integration with known setup metadata MUST expose contextual setup access from its integration card, with fields scoped to that integration.
- **FR-017**: MCP setup MUST distinguish secret and non-secret fields, required and optional values, documentation and configured presence; missing metadata MUST have an honest fallback.
- **FR-018**: Secret controls MUST distinguish keep, replace and clear, never treating an untouched blank field as an instruction to erase an existing value.
- **FR-019**: Configuration changes MUST retain explicit review, identity checks, existing write authority and post-save verification. No save implies a successful runtime restart or endpoint test.
- **FR-020**: Per-MCP setup MUST include configuration editing, guidance, reviewed command staging and direct execution of supported installation, registration and restart actions after explicit operator confirmation. The review MUST identify the target host, installation, integration, intended changes and interruption impact. Opening a card or saving a setting MUST NOT implicitly execute a setup action.
- **FR-021**: The extension MUST include an interactive 3D topology view with selection and navigation using attributable data, avoiding fabricated topology/status, offering a functional text alternative and releasing graphics resources when no longer in use. Motion elsewhere MUST be restrained and respect reduced-motion preferences.
- **FR-022**: The extension MUST include custom branded imagery, bundled for local use; generation MUST exclude private configuration, credentials and topology. Essential labels and controls MUST remain selectable accessible text, and imagery MUST adapt cleanly to light, dark and high-contrast presentation.
- **FR-023**: Existing Spec150 Chat, Canvas, Avatar, RAG, assistants, settings, Intent, peer, domain inspection and review behavior MUST remain available and be covered by proportionate regression verification.
- **FR-024**: New state and data operations MUST remain bound to the selected installation and runtime; existing workspace trust, interruption, cancellation and permission controls MUST be preserved.
- **FR-025**: Implementation MUST proceed only after the requested clarification, plan, tasks, cross-artifact analysis and resolution of every analysis finding. Discovered implementation findings MUST also be resolved and verified.
- **FR-026**: Work MUST remain local. No VSIX packaging, push, PR publication, live deployment, Marketplace publication, release or external blog publication is authorized. Each remains held until the owner explicitly requests it.
- **FR-027**: Setup execution MUST reuse supported NetClaw installation/runtime facilities, validate prerequisites and the reviewed target immediately before execution, capture a baseline and audit evidence, preserve unrelated configuration, show sanitized progress/results and verify the intended postcondition. Only supported, explicitly scoped operations may execute; unavailable actions, insufficient permissions, partial failures and unknown outcomes MUST remain explicit. Interrupted work MUST NOT automatically replay, and recovery MUST follow the underlying operation's supported behavior.

### Key Entities *(include if feature involves data)*

- **Connection profile**: Operator-chosen label, API address, host context and reviewed installation/runtime identity.
- **Domain card**: Purpose, human-readable title, current observation, source/time, primary actions and expandable details.
- **Testbed document**: Identified target, revision, device inventory, defaults, connections, interfaces, topology and credential references.
- **Testbed edit/import draft**: Source revision, selected operation, proposed changes, validation results and recovery information; inert until reviewed and saved.
- **Integration setup descriptor**: Integration identity, field metadata, configuration source, requirements, documentation and supported setup operations.
- **Configuration draft**: Selected installation/integration, changed fields, secret keep/replace/clear intent, review and verification outcome.
- **MCP setup operation**: Supported action, selected host/installation/integration, prerequisites, reviewed effect and confirmation, baseline, progress, sanitized outcome, audit evidence, verification and recovery guidance.
- **Visual asset**: Bundled branded image or data-driven visualization with purpose, attribution where needed, accessibility and fallback behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every existing view passes a recorded visual review for consistent headings, cards, labels, spacing, controls and all applicable loading/empty/error states; no primary view depends on a raw object dump.
- **SC-002**: Connection setup explains both inputs before entry, and a first-time walkthrough completes a correctly bound synthetic connection without external instructions or ambiguity about the nickname.
- **SC-003**: Guided create/read/update/remove, advanced YAML editing and every supported import/export path pass isolated testbed acceptance, including mode switching, cancellation, invalid input, concurrent edits, recovery and preservation of unrelated data.
- **SC-004**: Every integration with known configuration metadata can reach its scoped setup from its card in at most two interactions; secret keep/replace/clear and non-secret editing pass without exposing existing secrets. Every supported setup action passes isolated confirmation/cancellation, target validation, execution, failure/interruption and postcondition-verification acceptance.
- **SC-005**: All primary workflows remain usable with keyboard only, at 200% zoom and at 360, 700 and 1200 CSS-pixel view widths; content and controls are not clipped. High-contrast and reduced-motion checks pass.
- **SC-006**: On the recorded reference host, filtering 500 synthetic inventory entries visibly responds within 250 milliseconds after input settles; visual decoration does not block form input or hide failures.
- **SC-007**: Required Spec150 regression checks and new feature checks pass, and no unresolved analysis or implementation findings remain at handoff. Unexecuted platform checks are reported explicitly rather than claimed as passed.
- **SC-008**: The final local handoff provides a reviewable source build and evidence with zero package, push, deployment or publication actions.

## Assumptions

- The owner is an operator of existing NetClaw installations and has explicitly authorized local development of these capabilities, not changes to their real devices or credentials during testing.
- Direct per-MCP setup execution is an approved product capability; this does not authorize installing, registering or restarting MCPs in the owner's live environment during development. Acceptance uses isolated installations and clearly recorded platform coverage.
- Spec150 at merged main `357521eb883720aad581e6d0d278443d42e86ad1` is the functional baseline; its unpublished VSIX remains unchanged.
- The default scope is the extension. Existing NetClaw configuration/testbed facilities should be reused; any necessary supporting changes must be bounded and documented in the plan.
- Existing Mac, Linux, WSL and remote-host support boundaries remain unless the clarified scope explicitly changes them.
- “Adaptive cards” describes responsive grouped presentation, not a mandatory dependency.
- Three.js will support purposeful topology interaction, and custom image generation will supply branded artwork. No particular image-generation model version is assumed available. The shared card system remains the primary visual language, and motion elsewhere is restrained.
- Local development builds and isolated tests are allowed; packaging and distribution are separately prohibited.

## Owner amendment — security perimeter controls (2026-10-11)

The owner added editable OpenShell and DefenseClaw security pages: allow/block lists, status, logs and perimeter settings. Clarification6: **rules and enforcement modes**, with explicit confirmation for changes that weaken protection; lifecycle start/stop/restart is outside this addition. This expands the original aesthetics scope while retaining the publication/live-environment hold.

### US6 — Review and manage security boundaries (P1)

An operator opens either security page, binds an existing host-local security target, sees actual status and bounded logs, reviews its rules and makes a supported scoped change. The page names the shared profile or gateway/workspace/sandbox; the selected NetClaw identity does not imply exclusive ownership of that perimeter.

- **FR-028**: Security pages MUST expose capability-discovered status, bounded redacted logs/alerts, searchable allow/block rules and explicit unavailable/unsupported states for DefenseClaw and OpenShell.
- **FR-029**: Security targets MUST be selected through native host controls, bound to a verified existing runtime identity, and name their potentially shared scope. CLI paths/arguments/environment MUST never come from a webview command string.
- **FR-030**: DefenseClaw MUST support reviewed allow/block rule editing and supported guardrail mode/threshold settings through its native configuration writer, preserving unrelated fields and upstream managed-device restrictions. Existing secret configuration MUST stay out of ordinary views.
- **FR-031**: OpenShell MUST support reviewed edits to the selected sandbox's network policy, preserving filesystem/process and unrelated policy sections. Explicit layer7 deny rules and default-deny semantics MUST be distinguished from a universal blacklist. Gateway-global policies and immutable controls MUST not be silently edited through a sandbox form.
- **FR-032**: Security changes MUST show a before/after summary, affected scope, baseline and recovery location, then require native confirmation and a reason. Permission-expanding changes MUST carry a distinct weakening acknowledgment. Revision/target changes cancel the review; execution is serialized, verified and never automatically retried. Upstream concurrency limitations MUST be explicit.
- **FR-033**: Saved rules, loaded policy and observed enforcement MUST remain separate. Timeouts/disconnects after launch produce unknown outcomes; no success based on process exit alone. New lifecycle, quarantine, secret export, scan-triggered mutation and disabling-entire-perimeter controls are excluded.
- **SC-009**: Isolated adapter and editor tests cover both pages, malformed/stale scope, allow/block edits, enforcement settings, redaction, cancellation, failures, unknown outcomes and verification. Real upstream CLI/runtime qualification limits are recorded explicitly.

## Repository merge authorization (2026-10-11)

After local completion, the owner explicitly requested committing all work, opening and merging its PR into main, then waiting. This satisfies FR-026's explicit-request condition for commit/push/PR/merge only. Package, live deployment, release-tag, Marketplace and external release/blog publication remain held. Prepare the required unpublished source-version metadata under the existing contribution policy; component versions and existing artifacts remain unchanged.
