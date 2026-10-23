# Feature Specification: Workspace Files and Claw Controls

**Feature Branch**: `152-workspace-claw-controls`

**Created**: 2026-10-15

**Status**: Implemented; production PR/merge/publication authorized on 2026-10-16 with evidence-scoped qualification

**Input**: Create a new, focused VS Code extension feature and branch. After connecting to a claw, expose the six major workspace Markdown files in the extension's top panel: SOUL.md, AGENTS.md, IDENTITY.md, USER.md, TOOLS.md and HEARTBEAT.md. Support READ, UPDATE and UPLOAD / OVERWRITE, but no DELETE. Also provide a restart path after saving and let the operator fully Start, Stop and Restart the connected claw from this panel.

## Scope and Direction

Extend the upper **Connections** area of the NetClaw Activity Bar with the selected claw's identity, observed service state, direct **Start**, **Stop** and **Restart** controls, and a **Workspace Files** section. File selection opens a readable Markdown view with editing and upload actions. Keep connection selection and recovery reachable in this same upper area; users should not need to navigate to Integrations or stage terminal commands for supported operations.

This is management of the connected installation's actual operating files. The repository checkout, currently opened VS Code project and runtime workspace can be different locations. Never substitute shipped templates for observed installed files, and never silently write back to the repository instead of the selected runtime.

The owner confirmed both existing runtime choices, OpenClaw and Hermes, using their actual workspace and service ownership. The OpenClaw section is titled **OpenClaw Workspace Files**; the Hermes section is titled **Hermes Workspace Files**. A file's presence is distinct from whether that runtime consumes it. The file catalog below records the requested OpenClaw roles; Hermes loading behavior must be reported from its supported runtime behavior rather than copied from OpenClaw.

“Claw” means the selected installation on the current extension host. Full lifecycle actions cover its configured, installation-owned gateway/engine, HUD and federation services, including owned child processes where applicable. Federation peers, other member-claw installations, shared security services and managed network devices are outside that target. The extension's connection profile and host-side management access remain available while the claw is stopped.

All stories are required. Priority indicates delivery order, not permission to omit uploads or lifecycle controls. This specification does not authorize deploying changes to the owner's running installation or publishing an extension release.

### Managed File Catalog

| File | Purpose | OpenClaw loading context to explain |
| --- | --- | --- |
| `SOUL.md` | Core personality, CCIE expertise, operating rules and protocol knowledge references | Session-start identity and behavior context |
| `AGENTS.md` | Operating instructions, memory, safety, change management, Slack behavior and escalation | Session-start operating context |
| `IDENTITY.md` | Name, creature type, vibe and emoji | Session-start identity context |
| `USER.md` | Operator preferences, timezone, role and network personalization | Session-start user context |
| `TOOLS.md` | Local infrastructure notes, device and SSH references, channels and sites | Session-start local context |
| `HEARTBEAT.md` | Periodic reachability, adjacency, CPU/memory and syslog checks | Heartbeat-cycle instructions |

These descriptions explain intended use; they do not assert that a specific active conversation has loaded the current saved revision. Installed-runtime differences, disabled heartbeats and unverified loading must be visible when relevant.

## Clarifications

### Session 2026-10-15

- Q: OpenClaw only or both runtime connections? → A: Both OpenClaw and Hermes, using each runtime's actual workspace and engine controls.
- Q: Gateway/engine only or full selected-installation lifecycle? → A: Full selected installation, including its owned HUD and federation services.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect and read the correct workspace files (Priority: P1)

An operator connects to an existing claw, sees its six workspace files in the top panel, understands what each file controls and reads its actual saved Markdown without locating runtime folders manually.

**Why this priority**: Every write and lifecycle action depends on an unmistakable selected installation and a trustworthy view of current state.

**Independent Test**: Connect to two isolated installations with different file contents and workspace locations. Read each file, switch installations and exercise missing-file, disconnected and denied-access states without writes.

**Acceptance Scenarios**:

1. **Given** no selected installation, **When** the top panel opens, **Then** it offers the existing connection flow and does not show another claw's file contents as current.
2. **Given** a trusted, verified connection, **When** the panel refreshes, **Then** it shows the connection label, runtime, host context and workspace location, and all six catalog entries with purpose, loading context and observed availability.
3. **Given** an available file, **When** Read is selected, **Then** the complete saved Markdown opens with its filename, selected installation and revision; reading or refreshing makes no change.
4. **Given** a missing, unreadable, oversized or unsupported file, **When** the catalog is viewed, **Then** that entry shows the specific condition while other readable files remain usable; shipped template content is not presented as observed content.
5. **Given** two connections have identically named files, **When** selection changes, **Then** only the new target's observations are displayed and delayed responses from the previous target cannot update its views.
6. **Given** Markdown contains HTML, images, links or instructions, **When** it is viewed, **Then** it cannot execute commands, fetch external content automatically or authorize an operation. Source view remains available without rendering active content.

### User Story 2 - Edit and save an existing file (Priority: P1)

An operator edits identity, preferences, operating instructions or heartbeat content, reviews the change and explicitly saves to the selected claw. The interface reports whether the saved content was verified and whether a new session, heartbeat or restart is needed for use.

**Why this priority**: Updating these files is the main personalization workflow and must preserve operator-authored content.

**Independent Test**: Edit and save each of the six files in an isolated workspace. Reopen and compare exact saved content; exercise cancellation, stale edits, denied writes and interrupted verification.

**Acceptance Scenarios**:

1. **Given** a readable, writable file, **When** Edit is selected, **Then** a Markdown editor starts from the full current file and retains normal typing, selection, undo and keyboard behavior.
2. **Given** an unsaved edit, **When** Save is selected, **Then** the review identifies the installation, exact file, before/after changes and next-use guidance; applying it updates only that file and verifies the stored result.
3. **Given** a successful save, **When** the result is shown, **Then** saved-and-verified is distinct from runtime-loaded, and **Restart Claw** is available for the same target when lifecycle control is supported.
4. **Given** a file changes externally after reading or reviewing, **When** the operator applies the edit, **Then** newer content is preserved, the draft remains available and the operator must refresh/compare and review again before replacing it.
5. **Given** dirty content, **When** the operator closes the editor, chooses another file or switches connections, **Then** keep, discard or cancel behavior prevents silent loss and no draft can be applied to a different target.
6. **Given** a rejected or failed save, **When** the outcome is displayed, **Then** the last complete file is preserved where the write did not complete, recovery information is available, and no restart occurs. A write with unverified outcome is labeled unknown until observed.

### User Story 3 - Upload or overwrite one managed Markdown file (Priority: P2)

An operator chooses a local Markdown file, previews it against a selected catalog entry and uploads it to create a missing file or overwrite the existing one. The target name remains fixed to the catalog entry.

**Why this priority**: Upload supports migrating or maintaining an existing persona without manually copying long documents into an editor.

**Independent Test**: Upload a synthetic Markdown document to each catalog entry, including missing and existing destinations. Verify content, preservation of the other five files, invalid-input rejection and overwrite conflicts.

**Acceptance Scenarios**:

1. **Given** a selected catalog entry, **When** Upload is selected, **Then** the operator chooses one Markdown file and sees its source name, selected target filename, destination and full proposed replacement before applying.
2. **Given** an existing target, **When** the operator explicitly applies Overwrite, **Then** the old content has a private recovery copy and only the reviewed target is replaced and verified.
3. **Given** a missing catalog file, **When** a valid upload is applied, **Then** that exact file is created; a file created by another writer since preview causes a conflict rather than an implicit overwrite.
4. **Given** invalid encoding, a binary file, unsupported extension, excessive size, an unsafe target or a cancelled picker/review, **When** the upload is evaluated, **Then** no target changes and the reason is actionable.
5. **Given** any file view or command entry point, **When** its available operations are inspected or an unsupported deletion is requested, **Then** no delete/remove/rename operation is available and the file remains present.
6. **Given** an intentionally empty Markdown replacement, **When** it is reviewed, **Then** the review clearly states that all contents will be cleared; applying it leaves the named file present and uses the same overwrite protections.

### User Story 4 - Start, stop and restart the selected claw (Priority: P1)

An operator manages the connected claw directly from the top panel. They can stop it completely, retain its connection profile, start it again and verify recovery without opening a terminal or affecting another installation.

**Why this priority**: This is an explicit addition to the requested panel and enables recovery after changing runtime instructions.

**Independent Test**: Use isolated OpenClaw and Hermes installations with separately observable services. Exercise Start, Stop, Restart, already-running/stopped states, unavailable management, active work and failure recovery; keep a second installation running to prove isolation.

**Acceptance Scenarios**:

1. **Given** a bound installation, **When** the panel observes its state, **Then** running, stopped, starting, stopping, restarting, partially running, unreachable and unknown are distinguished; unsupported controls explain their prerequisites.
2. **Given** an eligible action, **When** it is selected, **Then** review names the installation, runtime, host, affected services and interruption impact before direct execution. No runtime action occurs merely by connecting or opening the panel.
3. **Given** a running claw, **When** Stop completes, **Then** its in-scope owned services are verified stopped, the profile remains selected, and Start remains usable through management access that does not depend on those services being up.
4. **Given** a previously bound, stopped installation, **When** Start completes, **Then** its existing configured service set is restored and the extension verifies the same installation identity before resuming connected operations.
5. **Given** a running or partially running installation, **When** Restart completes, **Then** the intended services have verifiably stopped and restarted, their readiness is observed and the extension reconnects to the same identity without replaying conversations or unfinished operations.
6. **Given** a second claw, unrelated service or process using the expected address, **When** lifecycle control runs, **Then** it does not signal, reconfigure or adopt that other target, and a conflict is reported instead of claiming success.
7. **Given** an active or unresolved request, **When** Stop or Restart is reviewed, **Then** known work and any inability to inspect work are stated explicitly; confirmation acknowledges interruption, and interrupted work is never reported as completed or automatically resubmitted.
8. **Given** a partial failure, timeout, extension reload or dropped connection, **When** the panel recovers, **Then** durable operation evidence supports observation of the actual result; unknown remains unknown until reconciled, with no blind retry.
9. **Given** a service supervisor would ordinarily restart an owned process, **When** Stop is requested, **Then** the supported lifecycle action stops the service at its owning control layer and verifies it stays stopped; losing its listener briefly is insufficient evidence.
10. **Given** no supported ownership-bound management path exists, **When** an action is selected, **Then** the panel states what is unavailable and how to enable supported management; it does not pretend that staging a command completed the requested action.
11. **Given** untrusted editor context, insufficient permissions or a denied operation, **When** file or lifecycle management is attempted, **Then** it is refused without changes, privilege expansion or an alternate bypass.
12. **Given** a file or lifecycle mutation, **When** audit evidence is inspected after completion or recovery, **Then** it identifies the action, target, revisions and observed outcomes without raw file content or credentials and remains available after Stop.
13. **Given** existing extension and assistant workflows, **When** the new panel is introduced, **Then** their relevant regression checks pass and assistant adapters gain no new direct file-write or lifecycle authority.

### User Story 5 - Save changes and restart deliberately (Priority: P2)

An operator chooses either **Save** or **Save and Restart** when editing or uploading a workspace file. They can also restart later from the saved result or top panel.

**Why this priority**: A deliberate, visible handoff between file persistence and runtime lifecycle makes the post-edit workflow complete without conflating the two outcomes.

**Independent Test**: Exercise Save alone, Save and Restart, restart later, failed saves, failed restarts, cancellation and target changes using isolated installations.

**Acceptance Scenarios**:

1. **Given** a valid edit or upload, **When** Save alone completes, **Then** the file is verified and no lifecycle operation runs; the result offers Restart Claw and explains when that file is next used.
2. **Given** Save and Restart is selected, **When** the operator reviews the file change and the lifecycle impact together, **Then** saving and verification complete first and only then may the reviewed restart begin for that same installation.
3. **Given** a failed, conflicted, cancelled or unverified save, **When** Save and Restart reaches that result, **Then** the restart phase does not begin.
4. **Given** a verified save followed by a failed or unknown restart, **When** results are displayed, **Then** they separately report the saved revision and each service outcome; they preserve the saved file and do not silently restore or resubmit it.
5. **Given** selection, identity, file revision or service scope changes between review and execution, **When** a phase is about to begin, **Then** stale approval cannot operate on the changed target; the interface requires a fresh review.
6. **Given** a successful restart, **When** the result is shown, **Then** it verifies runtime readiness while describing file-loading behavior accurately; it does not claim existing conversations reloaded their prompts without evidence. For a fully stopped claw the corresponding continuation is Start, with its own explicit review.

### Edge Cases

- A configured workspace may differ from both the runtime home and the repository. Missing or inconsistent location evidence must block writes rather than select a plausible path.
- Both runtimes may contain the six files but load them differently. File presence, saved revision, engine readiness and prompt consumption are separate facts.
- Missing files, empty files and permission-denied files are distinct. A directory or symbolic link with a catalog filename is not treated as a writable regular file.
- Case variants, traversal, encoded separators and a changed path after review must never redirect a write. Shared/aliased destinations need explicit ownership resolution; multi-linked targets are refused when isolation cannot be established.
- Markdown may contain code fences, Unicode, line endings, embedded HTML, private infrastructure details or text instructing the reader to take actions. Preserve source and treat it as data in this management interface.
- Upload selection and overwrite review may be cancelled independently. A failed read must not become an empty replacement.
- External writers include the running agent itself. Detect a revision change at application time, including creation of a previously missing file.
- Themes, narrow panels, editor navigation and pending requests must not blur inputs, drop keystrokes or silently clear a draft.
- Stopping the HUD removes the ordinary connection used by the editor. A retained profile alone is insufficient unless independent management can verify identity and start the same installation.
- Runtime kind, workspace, identity or host can change while a dialog is open. Such a change invalidates old observations, drafts' write authority and operation reviews.
- Some installations have no federation service, some services run on demand, and some are shared. Only the identified configured owned set is controlled; no absent optional service is installed or enabled implicitly.
- A service can be alive but unready, managed by a supervisor, use a stale ownership record or occupy a port belonging to another installation. These cases must not be reported as a clean start/stop.
- Restart can stop successfully and then fail to start. A lost response can also conceal a successful change. Preserve both stage outcomes and observe before offering another operation.
- Save and Restart can save successfully but fail before restart, or the operator may change the saved file again before restarting. Display the actual saved revision and require a current review where scope changed.
- A stop/restart may interrupt agent, chat or federation work. The interface cannot infer remote work cancellation from the local engine stopping and must not replay it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The upper Connections panel MUST retain connection management and expose the selected claw's workspace catalog and direct lifecycle controls. Primary actions MUST be reachable without navigating to another domain panel.
- **FR-002**: The catalog MUST contain exactly the six named managed files, with purpose, runtime-specific loading guidance and distinct available, missing, unreadable, unsupported and failed states. It MUST NOT become a general filesystem browser.
- **FR-003**: File operations MUST bind to the verified selected installation, runtime, extension host and actual configured workspace. Ambiguous location or identity MUST block writes; repository templates MUST NOT substitute for live contents.
- **FR-004**: Read MUST open complete saved Markdown with target attribution and revision. Editing MUST begin from that full content. Truncated views MUST NOT be saveable as complete files.
- **FR-005**: Every existing managed file MUST support explicit edit/update and a reviewed Save, preserving the submitted text, Unicode and line endings without silent document rewriting.
- **FR-006**: Upload MUST accept one UTF-8 `.md` file per operation and map it to one explicitly selected catalog entry. Source filenames MUST NOT supply destination paths. The initial limit is 1 MiB per file for reads, drafts and uploads, enforced consistently before writing; larger files MUST receive an actionable unsupported-size result.
- **FR-007**: Upload MUST support creating a missing catalog file and overwriting an existing one after target and content review. No other filename may be created. Every edit/update or overwrite of an existing target MUST retain a private pre-change recovery copy.
- **FR-008**: Save/overwrite MUST detect changes since read and since review, including missing-to-existing transitions, and prevent silent replacement of concurrent content. Conflict recovery MUST preserve the draft and offer refresh/compare and a new explicit review.
- **FR-009**: Writes MUST preserve the last complete original on a failed replacement, retain recovery evidence and verify persisted content before reporting success. Unverified outcomes MUST remain explicit and MUST NOT trigger automatic replay or restart.
- **FR-010**: This feature MUST expose no file delete, remove, rename or move operation through the panel, commands or supporting management surface. An explicitly reviewed empty replacement may clear content but MUST leave the named file present.
- **FR-011**: File access MUST remain confined to the verified managed workspace and catalog. Unsafe links, path redirection, non-regular targets and unresolved shared ownership MUST be refused rather than followed or repaired silently.
- **FR-012**: Dirty drafts MUST survive ordinary view/theme navigation or be protected by keep/discard/cancel choices. Switching installations MUST invalidate old write authority and prevent late responses from exposing or saving content under a new target.
- **FR-013**: Markdown viewing MUST NOT run scripts, commands, automatic external fetches or instructions embedded in the file. Private content and recovery copies MUST remain local to the authorized editor/runtime hosts and MUST NOT enter telemetry, assistant context, source control or logs automatically.
- **FR-014**: Start, Stop and Restart MUST directly control the selected installation's eligible owned services after explicit review, rather than only preparing commands. State and capability MUST determine available actions, with clear reasons when unavailable.
- **FR-015**: Lifecycle review MUST identify the selected installation, host, runtime and complete affected service set, including gateway/engine, HUD and configured owned federation services. Other claws, peers, managed devices and shared security services MUST be excluded.
- **FR-016**: Start MUST use the existing installed configuration and configured service set, verify readiness and restore only the same verified installation connection. It MUST NOT install dependencies, change credentials, enable new integrations or start an unrelated claw.
- **FR-017**: Stop MUST gracefully stop the in-scope services through their owning lifecycle control, verify they remain stopped and preserve files, credentials, installation identity and saved connection. The panel MUST retain a usable Start path independent of the stopped services.
- **FR-018**: Restart MUST execute an observed stop/start sequence for the reviewed target and service set, showing progress and per-service outcomes. It MUST NOT treat a command exit, lost connection or open port alone as proof of readiness or shutdown.
- **FR-019**: Lifecycle operations MUST validate ownership and current authority at execution, prevent duplicate/overlapping actions on the same target, and refuse foreign processes, stale ownership, identity changes and scope expansion. No process-name-wide termination or silent privilege escalation is permitted.
- **FR-020**: Service state MUST distinguish running, stopped, transitioning, partially running, unreachable, unsupported and unknown with observation time. Runtime readiness MUST NOT imply a provider call, tool call or loaded-file revision was verified.
- **FR-021**: Stop/restart review MUST disclose known active work and unavailable activity evidence. Explicit confirmation MUST acknowledge interruption. Existing request histories and unknown/interrupted outcomes MUST remain truthful; no pending work may be replayed automatically.
- **FR-022**: Lifecycle operation evidence MUST survive stopping the HUD, connection loss and extension reload. Recovery MUST inspect current state before another mutation, distinguish failure from unknown and retain a bounded, actionable result for each service and phase.
- **FR-023**: Save and upload flows MUST offer Save and Save and Restart, and successful Save results MUST offer Restart Claw when eligible. Save alone MUST never initiate lifecycle control. A stopped target MUST offer the corresponding explicit Start path.
- **FR-024**: Save and Restart MUST bind both phases to one reviewed target, draft and service scope; restart MUST wait for verified save success and revalidation. A changed selection, identity, saved revision or service set MUST invalidate stale continuation approval.
- **FR-025**: Combined results MUST report file persistence and lifecycle outcomes separately. Restart failure MUST NOT automatically revert a successful save. An explicit recovery overwrite MUST use the same target, review, conflict and verification controls.
- **FR-026**: Loading guidance MUST distinguish saved content from future session/heartbeat consumption and runtime readiness. Restart MUST NOT be represented as proof that existing conversations consumed the new instructions. Runtime/file combinations without verified consumption behavior MUST say so.
- **FR-027**: File and lifecycle operations MUST honor Workspace Trust, existing host/runtime permissions, security enforcement and applicable change-control policy. Editing operating instructions MUST NOT itself change tool grants, authorize network-device writes or bypass a denied management operation.
- **FR-028**: Mutations and their observed outcomes MUST be recorded with installation, action, target, timestamps, revisions and recovery references through the existing audit practices. Raw file contents and credentials MUST NOT be copied into routine audit output. Audit evidence MUST remain accessible after Stop.
- **FR-029**: The panel and editors MUST preserve keyboard navigation, visible focus, light/dark/high-contrast themes and usable narrow layouts. Typing MUST remain continuous and preserve focus and all keystrokes; asynchronous progress MUST not overwrite drafts.
- **FR-030**: Existing connection, Chat, Canvas, Avatar, RAG, testbed, MCP setup, security and assistant workflows MUST remain available. These new controls MUST NOT grant an assistant adapter direct workspace-write or service-control authority.
- **FR-031**: Supported runtime/host combinations MUST be explicitly qualified. Initial targets are OpenClaw and Hermes on macOS and Linux extension hosts, including Windows VS Code with WSL and existing Remote SSH hosts. Unsupported combinations and older installations MUST explain missing capabilities without silently using another runtime or host.

### Key Entities

- **Selected Installation**: Reviewed connection profile, installation identity, runtime kind, execution host, actual workspace and lifecycle-management binding; remains selectable while services are stopped.
- **Managed Workspace File**: One catalog filename, purpose, runtime loading context, resolved destination, availability, complete content and observed revision.
- **File Draft and Review**: Proposed text or uploaded source, target identity, baseline revision or observed absence, proposed change and explicit operator choice; scoped to one target.
- **Recovery Copy**: Private original content and its relationship to the target, revision and attempted write, usable through a reviewed overwrite.
- **Service Set**: Existing configured gateway/engine, HUD and optional federation services with observed ownership, capability and per-service state.
- **Management Operation**: Reviewed file or lifecycle intent, target, affected services, stage progress, audit references and verified/failed/unknown outcome. Save and Restart links two separately observable phases.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance fixtures for each supported runtime, all six file entries are visible from the top panel after connection; each readable file opens in at most two deliberate actions from that panel and matches its actual saved source.
- **SC-002**: Read, edit/save and upload/overwrite pass for all six files. Missing-file upload succeeds for each catalog entry, and every case preserves all unselected files byte-for-byte. All deletion/path-escape attempts are refused with no target change.
- **SC-003**: Every tested stale edit, stale review, missing-to-existing race, denied write and target switch prevents an unreviewed replacement. Every verified save reopens with the submitted content, and every replaced original has recoverable evidence.
- **SC-004**: Start, Stop and Restart each complete against isolated OpenClaw and Hermes installations on every claimed supported host combination. Every Stop leaves a usable Start action, every recovered connection matches its original identity, and a neighboring installation remains unaffected throughout.
- **SC-005**: Save alone produces zero lifecycle actions. Save and Restart produces exactly one reviewed restart after a verified save, and zero restarts after every cancelled, conflicted, failed or unknown save in the acceptance matrix.
- **SC-006**: Every injected lifecycle fault, active-work interruption, lost response and extension-recovery case reports verified, failed or unknown stage outcomes without false success, duplicate execution or replayed user work. The panel remains usable for status and recovery when the HUD is down.
- **SC-007**: All primary file and lifecycle workflows pass keyboard-only checks in light, dark and high-contrast themes, at 360-pixel panel width and 200% zoom. Continuous typing, Unicode insertion, undo and view changes preserve the expected draft and focus.
- **SC-008**: On an available local acceptance installation, file reads and save results for files up to 256 KiB appear within two seconds in at least 95% of 20 trials; lifecycle actions show progress within one second and reach an observed outcome or explicit timeout within a documented 120-second observation window. Timeout never implies cancellation or automatic retry.
- **SC-009**: Privacy checks find zero raw workspace contents or credentials in routine logs, telemetry, assistant context or committed artifacts, and zero automatic external requests from Markdown display. Relevant existing extension workflows pass regression verification.

## Assumptions

- “Top panel” means the existing upper Connections section in the NetClaw Activity Bar, with file reading/editing allowed in the main editor area. This preserves the current workbench layout while placing the new entry points beside connection selection.
- The confirmed runtime scope is OpenClaw and Hermes. The six-file catalog is shared, but actual location, loading behavior and lifecycle support are runtime-specific. Presence never guarantees consumption.
- The owner confirmed that “fully stop/start/restart” means all configured services owned by the selected installation, including its HUD and federation service where present. It does not mean shutdown of the host, other member claws, peer services or shared security infrastructure.
- First connection continues to identify an existing running installation. Once reviewed and bound, a saved installation can be managed while stopped. First-time provisioning, new remote transports and installation of missing prerequisites are outside this spec.
- The operator is authorized to manage the selected installation under its existing permissions and policies. An unavailable or prohibited operation stays unavailable; this interface adds no bypass.
- Upload is a single-file replacement workflow. Arbitrary files, directories, bulk synchronization, template reset, automatic content rewriting and file deletion are excluded.
- Save is explicit. Save and Restart is an optional explicit combined action, and restart later remains available. File editing does not automatically start a heartbeat, new conversation, network check or provider request.
- Product behavior must support macOS and Linux execution hosts, including WSL and Remote SSH as above. A platform is not declared qualified until its relevant editor, workspace and lifecycle acceptance is recorded; no new native Windows runtime or browser-editor support is implied.
- Existing source differs on the Hermes persona directory. Planning must resolve authoritative workspace discovery and ownership for both runtimes before implementing writes. Full lifecycle management likewise depends on verified control paths that survive stopping the HUD; existing command staging alone does not satisfy this feature.
- On 2026-10-15 the owner authorized planning, implementation, verification and an ephemeral VS Code preview of the built feature. Push, live deployment and publication remain held until the owner reviews the preview. All development lifecycle operations must target isolated installations.

- Later on 2026-10-15 the owner explicitly authorized packaging, a WSL handoff prompt and pushing the feature branch for a real-runtime isolated editor preview. This supersedes the earlier package/push hold. No merge, Marketplace release or unattended live lifecycle action is authorized.

- On 2026-10-16 the owner authorized fetching WSL changes, commit/PR/merge, completed-branch deletion, return to main and production publication. This supersedes prior Spec152 release holds. See release-verification.md for failures/remediation and actual qualification limits.
