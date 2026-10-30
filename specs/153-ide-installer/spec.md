# Feature Specification: IDE Installer — Zero to a Tested Claw or Risk

**Mac-first sequencing (owner, 2026-10-18):** [MAC-COMPLETION.md](MAC-COMPLETION.md) fixes the remaining Mac exit gate. Windows/WSL handoff is held until it passes; Windows then tests smoke/platform differences, followed by Mac regression and final human walkthrough/recording. Existing 84-task scope is unchanged.

**Feature Branch**: `153-ide-installer`

**Created**: 2026-10-17

**Status**: Clarified — supplied owner decisions retained; five additional Spec Kit clarifications completed on 2026-10-17; planning authorized

**Input**: Move NetClaw installation into the IDE so that anyone, not only CLI experts, can go from nothing to a fully configured, verified claw or Risk. Instead of starting with `git clone`, a user installs the NetClaw VS Code extension, chooses **Set Up a New Claw** and follows a guided path in which every option and its documentation are laid out. The same outcome must also be reachable from the CLI/TUI and from AI assistants. Supported assistants are GitHub Copilot, plus Claude Code and Codex in the VS Code terminal. Assistant modes are back-and-forth Q&A, a single intent prompt, or spec-driven development with GitHub Spec Kit. Use the existing VS Code card theme. Link every skill, MCP, Border or member being set up to its original MCP or vendor documentation and to the settings it requires.

## Scope and Direction

Through Spec 152 the extension manages an **existing** installation, and Spec 152 explicitly excluded first-time provisioning and missing prerequisites. This feature makes first-time provisioning a first-class extension capability. The CLI path stays fully supported.

A host may already contain one or more claws. Setup must clearly identify detected installations and explain that **Set Up a New Claw** creates a separate installation in a new, empty runtime home. The extension must support managing multiple installations on the same host through distinct saved connections and an explicit selected installation. Creating another claw must preserve the existing claws and their management access.

### Three ways in, one plan

| Pathway | Nickname | How the user drives it |
| --- | --- | --- |
| CLI | "the DOS way" | `git clone`, then `./scripts/install.sh` (TUI or flags) |
| Wizard | "the Windows 95 way" | Install the extension, choose **Set Up a New Claw** and follow guided cards |
| Assistant | "the AI way" | Copilot agent mode, or Claude Code / Codex in the VS Code terminal, in **Q&A**, **Intent** or **Spec** mode |

Every pathway produces the same artifact: a **Claw Plan**. A Claw Plan is a versioned, schema-validated, secret-free description of the intended installation. One **setup engine** in the selected NetClaw checkout validates, explains, applies and verifies a plan, and one **Claw Report** proves the result. Front-ends differ only in how they gather choices. For the same plan they MUST NOT differ in what gets installed, and no pathway gets a private installer.

### Supported platforms

There are exactly two qualified pathways:

- **macOS**: the extension host is local macOS, and the claw is installed on that Mac.
- **Windows with WSL2**: the claw is installed in, and runs inside, a supported WSL2 Linux distribution, with VS Code connected through its WSL remote. Native Windows hosting remains unsupported.

In a native Windows VS Code window, the extension performs only a **read-only prerequisite gate**. If WSL is not enabled, only WSL 1 is available, no supported distribution is installed, or the VS Code WSL extension is missing, setup **hard-stops**. The stop names the unmet condition and links to the official guides and a NetClaw prerequisites guide. The extension never enables Windows features, elevates, reboots, or installs a distribution. Once the prerequisites are met, it offers to reopen in WSL and resumes there. The read-only gate ends at this explicit handoff action: handoff separately discloses starting the chosen distribution, writing a private non-secret resume record and possible VS Code Server setup. Linux-side OS identity is checked before installation.

Existing connection management on other Linux hosts and Remote SSH continues unchanged. Zero-install there is not qualified in this feature.

### The guided tree

Setup is an ordered decision tree whose branches stay visible:

1. **Platform and prerequisites**
2. **Source**: latest release (default) or `main`, and the destination folder
3. **Harness**: OpenClaw or Hermes for the focused claw or Border; Risk members inherit this choice by default and may explicitly override it
4. **Model provider**: Local or Cloud, then provider and model (per claw in a Risk)
5. **Communication channels**, or none
6. **Shape**: a focused claw, or a Risk (one Border plus members), with a **Shape Advisor**
7. **Capabilities**: MCPs and skills (profile start, then per card), per member for a Risk
8. **Settings and credentials**, for exactly what was chosen
9. **Network inventory** (testbed), optional
10. **Identity and posture**: personalization files, lab/production stance and security layers
11. **Review → Apply → Verify → Connect**

Changing an earlier answer re-validates every downstream step. Before anything is discarded, the user sees what the change invalidates.

### Cards and documentation

All setup surfaces use the Spec 151 card theme the extension already uses. These are not literal Microsoft Adaptive Cards. Every option card covers harness, provider, channel, shape, profile, MCP, skill, Border and member choices. Each card shows its purpose in plain language, when to choose it, platform support, prerequisites and the settings it needs. It also links to vendor or product documentation, the upstream MCP or project repository, the NetClaw documentation and, for skills, the `SKILL.md`. Card content comes from one canonical component catalog shared by the TUI, the wizard, the engine and the assistant tools.

### Human authority boundary

Assistants and specs may gather choices, draft and validate plans, and explain them. Applying a plan requires human review: the native VS Code review in the extension, or the operator's own interactive confirmation in the CLI.

Secret values are entered only by the human, in native secret inputs or the engine's terminal prompt. They never enter a plan, assistant context, logs or evidence.

All stories are required. Priority indicates delivery order, not permission to omit a story. This specification does not authorize pushing, merging, packaging for release, Marketplace publication, or changes to the owner's real installations. Development and acceptance use isolated fixture homes and disposable hosts.

## Clarifications

### Session 2026-10-17

- Q: Which platforms? → A: Two pathways, macOS and Windows with WSL. If WSL is not enabled on Windows, hard-stop with links and guides to meet the prerequisites.
- Q: Where does the code come from? → A: `github.com/automateyournetwork/netclaw`. Offer both the latest release and current `main`.
- Q: What does "fully operational" cover? → A: Everything: harness, LLM provider (local or cloud), communication channels, MCPs, skills and members. These are distinct tree-like pathways in that order: harness first, then provider, channels, then MCPs/skills/members. Setup must help the user decide between a small focused claw that does not need a Risk and a Border with members.
- Q: Risk scope for this feature? → A: A focused claw, and a single-host Risk (Border plus local members). Multi-host members and eN2N external peering are deferred to a follow-up specification.
- Q: Literal Adaptive Cards? → A: No. Use the current VS Code card theme the extension has adopted (Spec 151).
- Q: Assistant integration? → A: The extension already integrates Copilot, Claude Code and Codex for an existing claw. This feature makes Copilot and the terminal harnesses capable from start to finish, beginning from zero. The owner accepted the proposed design: one shared cross-harness install skill, provisioning-mode setup tools on the extension's MCP server, a Spec Kit preset, no secret values to assistants, and human-reviewed apply.
- Q: Component metadata? → A: Introduce a canonical catalog for every component, with documentation links, validated in CI. The TUI stays backward compatible.
- Q: Deliverables and qualification? → A: Spec Kit format in `specs/153-ide-installer/`. Qualify on macOS, on WSL, on a clean Ubuntu-in-WSL host and on Windows gate hosts.
- Q1 (additional clarification): If setup finds an existing OpenClaw or Hermes runtime home, how should Set Up a New Claw behave? → A: Require a separate, empty runtime home. Clearly state that an existing NetClaw was detected and this install will be a different installation; support managing multiple claw installations on the same machine.
- Q2 (additional clarification): Within one Risk, should the Border and members be able to use different harnesses? → A: Allow mixed OpenClaw/Hermes Risks, choosing the harness per claw. Members inherit the Border's harness by default, with explicit overrides where supported.
- Q3 (additional clarification): If the user requests production mode but required security controls are unavailable, how should setup proceed? → A: Stop and explain the missing controls. Continue only after those controls are verified or the user explicitly chooses testing mode and reviews the revised plan; never automatically downgrade the requested posture.
- Q4 (additional clarification): If VS Code closes during installation, what should happen? → A: Pause at the next safe checkpoint and offer Resume when VS Code reopens. Abrupt termination remains an unknown outcome that must be checked before retrying; installation must not continue unattended through later phases.
- Q5 (additional clarification): What should the exported installation report include by default? → A: Redact hostnames, IP addresses, usernames and local paths by default; offer an explicitly reviewed detailed export. Both exports save locally and always exclude secrets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start from nothing on a supported computer (Priority: P1)

A network engineer who has never used a terminal installs the extension from the Marketplace, opens the NetClaw view and selects **Set Up a New Claw**. The wizard identifies the platform and checks every prerequisite. It then either gets the computer ready or stops with clear instructions.

**Why this priority**: This is the front door. Nothing else is reachable for a non-CLI user without it.

**Independent Test**: Use a clean macOS host with only OS-provided tools. Also use Windows hosts with WSL disabled, with WSL 1 only, with WSL 2 but no distribution, and with WSL 2 plus a supported Ubuntu. Run the platform and prerequisite steps on each. Do not install NetClaw. Compare a host snapshot before and after each gate run.

**Acceptance Scenarios**:

1. **Given** VS Code with the extension and no NetClaw on the host, **When** the NetClaw view opens (including in an empty window), **Then** **Set Up a New Claw** is a primary action beside **Add existing NetClaw**, and opening the view changes nothing on the host.
2. **Given** a native Windows window where WSL is not enabled, **When** setup starts, **Then** a hard-stop card explains that WSL2 is required. It links to Microsoft's WSL installation guide, VS Code's WSL guide and the NetClaw Windows prerequisites guide, and offers **Re-check**. No Windows feature, elevation, reboot, download or distribution install occurs.
3. **Given** WSL is enabled but only WSL 1 distributions exist, no distribution exists, the distribution is unsupported, or the VS Code WSL extension is missing, **When** the gate runs, **Then** the specific unmet condition is shown with matching guidance, under the same no-change guarantee.
4. **Given** WSL2 with a supported distribution, **When** the user continues, **Then** the wizard offers **Reopen in WSL** for a chosen distribution and explains that NetClaw will be installed inside it. After reopening, setup resumes at the next step with every previously entered non-secret answer.
5. **Given** a macOS or WSL2 extension host, **When** prerequisite checks run, **Then** each prerequisite gets a card showing the observed value, required value, reason, documentation link and remedy. Prerequisites cover OS version, architecture, free disk, git, Node per the runtime policy, Python per the component policy, `uv` and Docker where selected components need them, and reachability of GitHub and package registries.
6. **Given** a missing prerequisite with a supported automatic remedy, **When** the user chooses **Install for me**, **Then** the exact command is reviewed first and runs in a visible terminal, where any OS password is typed by the user. The check then re-runs. The extension never captures passwords, never silently replaces a runtime managed by a version manager, and never runs npm under sudo.
7. **Given** an unmet platform-level prerequisite, **When** the user tries to continue, **Then** setup cannot pass the platform step. An unmet component-specific prerequisite instead marks only the dependent components unavailable, with the reason.
8. **Given** one or more existing claws on the host, **When** setup detects them, **Then** it shows each detected installation's identifying details and available status evidence, states that this setup creates a separate claw, and offers either to manage an existing installation or continue with a new, empty runtime home. A stopped or unavailable claw is still an existing installation; it must not be overwritten.

---

### User Story 2 - Get NetClaw: latest release or main (Priority: P1)

The user chooses which NetClaw to install and where, without knowing git.

**Why this priority**: Every later step runs code from the acquired checkout, so its identity must be unambiguous.

**Independent Test**: Acquire both channels into empty folders. Retry against an existing clean checkout, an existing dirty checkout, a non-empty unrelated folder, a simulated network failure and a simulated API rate limit. Verify the recorded source identity each time.

**Acceptance Scenarios**:

1. **Given** the source step, **When** it opens, **Then** **Latest release** (default, recommended) and **Main** (development, may be ahead of the release) are offered. The resolved tag or commit, its date, the release notes or commit link, and compatibility with this extension version are shown.
2. **Given** a destination, **When** it is chosen, **Then** the default is `~/netclaw` on the extension host (inside WSL on Windows) and is editable. A non-empty folder that is not a NetClaw checkout is refused. An existing NetClaw checkout can be used as-is after review (its version, branch and local changes are shown), or the user can choose another folder. A clean checkout may be updated after review only when it is verified not to serve an existing installation; otherwise setup requires a separate source destination for the update. Local changes are never reset or overwritten. Reusing source does not permit reusing an existing runtime home.
3. **Given** acquisition, **When** it completes, **Then** origin, ref and commit are verified against the selection before any repository code executes, and the source identity is recorded.
4. **Given** a checkout whose setup engine protocol is outside the extension's supported range, **When** setup continues, **Then** engine execution is refused with options: choose a compatible release, update the extension, or choose another source.
5. **Given** a network failure, proxy or TLS interception, or rate limit, **When** acquisition fails, **Then** an actionable error is shown. A partial folder is removed only if this run created it, and retry is offered.

---

### User Story 3 - Walk the tree to a focused claw (Priority: P1)

The user moves through harness, provider, channels, shape, capabilities, settings, inventory and identity, understanding every option, and reaches a reviewable plan.

**Why this priority**: This is the core guided experience, and it is the decision path that every other pathway mirrors.

**Independent Test**: Build focused-claw plans for OpenClaw and for Hermes, with local and cloud providers, with and without channels, using two different profiles. Change an early answer after completing later steps and confirm the downstream invalidation behavior. No apply is needed.

**Acceptance Scenarios**:

1. **Given** any step, **When** the tree map is viewed, **Then** completed, current and upcoming steps are visible, along with the branches not taken. Any completed step can be reopened.
2. **Given** the harness step, **When** OpenClaw and Hermes cards are shown, **Then** each explains what it is, its strengths, platform notes and documentation links. Downstream provider, model, channel and persona-loading options come from the selected harness's supported interfaces and the catalog, not from hard-coded copies.
3. **Given** the Local provider branch, **When** it is chosen, **Then** supported local model runtimes are detected and their installed models listed. Hardware, memory and disk expectations are explained. Any model download shows its size and requires explicit consent.
4. **Given** the Cloud provider branch, **When** a provider is chosen, **Then** a model can be selected and the credential is entered in a secret input. Provider documentation and pricing links are shown. Optional key verification discloses a bounded billable test and its limits; if it uses an agent turn, that turn may involve multiple model or auxiliary calls.
5. **Given** the channel step, **When** channels are offered, **Then** each lists its setup requirements and documentation (for example, how to create the Slack app). Multiple channels can be selected. **None — use VS Code and the HUD** is a first-class choice.
6. **Given** the capability step, **When** the user starts from an existing profile (`minimal`, `recommended`, `cisco`, `multivendor`, `cloud`, `security`, `labs`, `observability`, `full`), **Then** component, skill and estimated tool-context counts are shown. The user can refine per card, search and filter by category or vendor, see dependencies explained (for example, a skill requiring an MCP), and see platform-incompatible items disabled with the reason.
7. **Given** the settings step, **When** it opens, **Then** only fields for selected items appear. Each shows its label, whether it is required or conditional, its secret classification, help, an example and shared-use disclosure. Optional fields may be marked **Configure later**, and those components later report `configuration_required` rather than hidden failure.
8. **Given** the inventory step, **When** the user adds devices, **Then** a guided testbed is created using the existing testbed editor model, with credentials as environment references. Skipping is allowed.
9. **Given** the identity and posture step, **When** completed, **Then** the claw's name, emoji and operator preferences are written to the installation's identity and user files using Spec 152 semantics. A lab or production stance is chosen. Optional security layers are offered only where supported. Defaults are the safest supported values.
10. **Given** a complete tree, **When** review opens, **Then** the plan summary by step, the effects disclosure and the plan hash are shown. Effects cover downloads with approximate size, directories, files, services, ports, background processes and external accounts touched. Actions are **Apply**, **Save plan** and **Back**.

---

### User Story 4 - Decide between a focused claw and a Risk, and build a single-host Risk (Priority: P1)

The user gets an honest recommendation about whether they need a Risk. If they want one, they configure a Border and focused members on the same host.

**Why this priority**: Choosing the wrong shape is the most expensive mistake a new user can make, in both tokens and blast radius. The Risk is NetClaw's flagship architecture.

**Independent Test**: Feed the Shape Advisor small, medium and very large capability selections, and selections spanning multiple credential trust domains, and record each recommendation and its reasoning. Apply single-host Risks with each supported Border harness and at least three members using both OpenClaw and Hermes and at least two providers in isolated fixture homes. Verify inherited and explicitly overridden member harness choices, all four Border/member harness pairings, per-member option compatibility and secret scope, and honest refusal of unsupported combinations.

**Acceptance Scenarios**:

1. **Given** the shape step, **When** it opens, **Then** **Focused claw** and **Risk (Border + members)** are explained in plain language, alongside the **Shape Advisor**.
2. **Given** the Shape Advisor, **When** the user answers its short questions, **Then** it computes estimates for both shapes from catalog data and the current selection: tool schemas, MCP servers, skills and per-turn tool context. The questions cover vendor/tool domains, separate credential trust domains, production enforcement, cost sensitivity and expected growth. The Advisor recommends a shape with stated reasons and labels the numbers as estimates. The user decides, and can switch at any point before apply.
3. **Given** a Risk, **When** it is configured, **Then** the user names and describes it, and the internal stack (iN2N) is enabled. eN2N and multi-host members are shown as not available in this version, with a documentation link. The Border carries gateway, channels, routing, audit and memory and no domain skills. Members come only from member profiles valid for their selected harness, capabilities and configured backends. Each member has a name, harness, profile, provider and model (tiered models encouraged) and a **hot** or **on-demand** mode. Its harness defaults to the Border's and may be explicitly changed to OpenClaw or Hermes where supported; provider/model and capability choices are validated against that member's harness.
4. **Given** member secrets, **When** the Risk is reviewed, **Then** each member's secret scope is listed by key name only, and each member receives only the secrets its own integrations require.
5. **Given** apply, **When** the Risk is created, **Then** the Border and members are created on the same host. Members enroll automatically over loopback using single-use tokens, which never appear in the plan, assistant context, logs or evidence.
6. **Given** the Risk mode, **When** **production** is requested and its required controls cannot be verified for the host or any selected claw, **Then** setup stops before apply and identifies the missing controls and affected claws. It continues only after the controls are verified or the user explicitly selects **testing**, generating a revised plan that requires fresh review. Setup never switches posture automatically. After apply, the reported posture is honest and never claims production while a control is missing.
7. **Given** inherited and explicitly overridden member harnesses, **When** the Border's harness changes, **Then** setup previews the impact on inherited members and revalidates every member's compatibility and downstream choices before review. Explicit overrides remain explicit; no provider, model, capability or posture is silently substituted. The reviewed plan and report identify the resolved harness for the Border and every member.

---

### User Story 5 - Apply with visible progress, resume and honest failures (Priority: P1)

After review the user applies the plan, watches meaningful progress, and can recover from interruptions without starting over.

**Why this priority**: Non-CLI users cannot diagnose a stalled shell script. Progress, isolation of failures and resume are what make the wizard usable for everyone.

**Independent Test**: In isolated fixture homes, inject the following during apply: editor reload, window close, network loss, host sleep and reboot, a cancelled native harness onboarding step, a failing optional component, a second concurrent run, and a pre-existing runtime home. Verify the outcome of every phase.

**Acceptance Scenarios**:

1. **Given** apply, **When** it runs, **Then** phases are shown with per-component progress cards and log access. Phases are: prerequisites, source verification, harness install, harness onboarding, components, skills, registration, credentials, inventory, identity, Risk, services and verification.
2. **Given** a harness step with no supported non-interactive interface, **When** it is reached, **Then** the harness's native interactive step runs in a visible terminal with an explanation. The wizard waits, then verifies the resulting configuration rather than assuming success.
3. **Given** an optional component fails, **When** apply continues, **Then** other components proceed. The final state lists each component as verified, failed, `configuration_required` or unverified, with its log and a retry action.
4. **Given** an interruption, **When** the user returns, **Then** the wizard shows the run and offers **Resume from the last verified phase**, waiting for an explicit Resume action. It revalidates plan review, target ownership and required controls before continuing. Completed phases are not repeated unless their verification fails, and unknown outcomes are observed before proceeding. Nothing is blindly replayed; secrets lost with the editor session are re-prompted.
5. **Given** an active run, **When** a second run targets the same runtime home, **Then** it is refused and the owning run is identified.
6. **Given** existing installations or runtime homes, **When** a new-claw plan is reviewed or applied, **Then** it refuses an occupied runtime home and preserves existing installation configuration, credentials, identity and services. Source reuse follows User Story 2; existing-claw operations remain available through that installation's selected management connection.
7. **Given** a wizard-owned installation is running, **When** its VS Code window closes or reloads, **Then** setup requests a pause, starts no subsequent phase after detecting the disconnect, and brings any in-flight work to its next safe checkpoint where possible. It records paused only when the checkpoint is verified and no owned installation operation is still mutating the target. Reopening offers Resume rather than automatically continuing. This pauses installation orchestration; it does not stop already installed claw services.
8. **Given** an abrupt editor/engine termination or an in-flight operation whose outcome cannot be established, **When** setup recovers, **Then** the affected work is marked unknown and observed before retry. It never claims a clean pause, releases exclusive ownership while a writer remains active, or starts a replacement writer without resolving the prior operation.

---

### User Story 6 - Prove it works, then land in the Workbench (Priority: P1)

The user ends with evidence, not hope. They see exactly what is verified, then continue in the existing Workbench.

**Why this priority**: "Fully operational, configured and tested" is the promise of this feature.

**Independent Test**: Run every verification tier against fixture installations in which selected checks are made to pass, fail, be skipped or remain unverified. Confirm that the report never infers success. Confirm that the connection handoff produces a binding that matches the installation identity. Keep two claws on one fixture host (including a same-harness pair), switch their saved connections and exercise existing settings, workspace and lifecycle controls; verify that each operation affects only its selected installation and that adding the second preserves the first.

**Verification tiers**:

| Tier | Proves | Default |
| --- | --- | --- |
| 1 Installed | Runtime and component artifacts present (existing readiness) | On |
| 2 Discoverable | Each selected MCP's tools discovered through its access path (`discovery_verified`) plus the harmless local canary | On |
| 3 Running | Gateway/engine and HUD running; extension connects; installation identity matches the plan | On |
| 4 Thinking | One live model turn through the configured harness and provider (cost disclosed) | Opt-in |
| 5 Channels | One test message per configured channel, each individually approved | Opt-in |
| 6 Network | One read-only observation (a `show` command) against one selected inventory device | Opt-in |
| Risk | Border up; every member enrolled and pinned; hot members answer a routed self-status; posture reported | On for Risks |

**Acceptance Scenarios**:

1. **Given** verification completes, **When** the **Claw Report** card opens, **Then** each tier and component shows exactly one state: verified, failed, `configuration_required`, skipped or unverified. Nothing is inferred.
2. **Given** Tier 3 is verified, **When** the user continues, **Then** the new installation is offered as a saved connection through the existing identity review, and the Workbench opens with suggested first actions.
3. **Given** a report, **When** it is exported, **Then** the default local export redacts hostnames, IP addresses, usernames and local paths while retaining outcome states, versions and useful diagnostic categories. A detailed local export including those private identifiers requires explicit review. Both formats always exclude secrets and enrollment tokens, preserve evidence provenance without exposing private path references in the default export, and never send data automatically. Verification can be re-run later from the connection.
4. **Given** every selected tier verified, **When** the report is shown, **Then** it may celebrate in NetClaw's lobster voice. Outcome labels always remain literal.
5. **Given** multiple saved claws on one host, **When** the user selects one for the Workbench or management, **Then** its name, harness and runtime home identify the target. Settings, workspace files, status and supported Start/Stop/Restart actions bind only to that installation; a stale selection is revalidated before any write. Adding or managing one claw does not replace another connection or silently switch the target of an in-flight operation.

---

### User Story 7 - Assistant Q&A install with Copilot, Claude Code or Codex (Priority: P1)

A user opens Copilot Chat in agent mode, or Claude Code or Codex in the VS Code terminal, and says "help me set up NetClaw." The assistant interviews them along the same tree, explains each option with documentation links, and builds and validates a plan. It then hands the plan to the human review. The whole path works starting from zero, with no prior NetClaw checkout.

**Why this priority**: The owner requires start-to-finish capability with Copilot and the terminal harnesses.

**Independent Test**: On each qualified platform with no installation, complete a Q&A install with each assistant. Record every tool call. Confirm that no tool applied a plan, executed an arbitrary command or received a secret value, and that the resulting installation matches a wizard installation of the same plan.

**Acceptance Scenarios**:

1. **Given** no installation, **When** the user chooses **Set up with an AI assistant**, **Then** they pick Copilot, Claude Code or Codex. The extension enables provisioning-mode setup tools for that assistant after review (registration commands are staged for terminal harnesses), installs the shared install skill with consent and supplies a starter prompt. No NetClaw checkout or host Node is required first.
2. **Given** a Q&A session, **When** the assistant proceeds, **Then** it follows the tree order, asks one decision at a time, explains options using the catalog tools and their links, and never invents component IDs, flags or settings.
3. **Given** read-only setup tools, **When** the assistant checks the platform, prerequisites, catalog, plan validation or effects, **Then** the results match the wizard's.
4. **Given** a required secret, **When** the assistant requests it, **Then** a native secret input opens in VS Code, and the assistant learns only whether a value was provided.
5. **Given** a validated plan, **When** the assistant submits it, **Then** the wizard review opens in VS Code with assistant attribution, and only the human can choose **Apply**. The assistant can follow progress and verification through read-only tools and help troubleshoot using redacted summaries.
6. **Given** the same plan, **When** applied through the assistant pathway, **Then** the installed result is equivalent to the wizard pathway's.
7. **Given** a terminal harness, **When** a state-changing host command is needed, **Then** the skill instructs the assistant to stage it for the human, not run it. The documentation states plainly that harness permission settings, not NetClaw, govern what a terminal agent can execute.

---

### User Story 8 - Intent install from one prompt (Priority: P2)

An experienced user writes one rich prompt, for example: "Hermes on my Mac, local Ollama for members, a cloud model for the Border, Slack, a Risk with pyATS, NetBox and ISE members, lab mode." They get a complete plan back, with its assumptions and gaps made explicit.

**Why this priority**: It is the fastest path for capable users and builds on the Q&A tools.

**Independent Test**: Run a set of intent prompts, from complete to contradictory to underspecified, through each assistant. Compare the drafted plans, assumption lists and gap lists against expected results.

**Acceptance Scenarios**:

1. **Given** an intent prompt, **When** processed, **Then** the assistant drafts a complete plan plus an explicit list of assumptions and unresolved gaps. Required decisions are never silently defaulted.
2. **Given** the draft, **When** validated, **Then** validation results and the Shape Advisor's recommendation are shown, and contradictions (for example, a component incompatible with the platform) are flagged.
3. **Given** gaps, **When** they are resolved through short Q&A or in the wizard, **Then** the same review and apply flow follows.
4. **Given** documentation, **When** the user looks for help writing intents, **Then** example intent prompts are shipped in the docs and in the extension.

---

### User Story 9 - Spec-driven claw with GitHub Spec Kit (Priority: P2)

A user who already works spec-first describes the claw as a specification. Spec Kit turns it into a Claw Plan, and the deployment folder becomes living documentation of their claw.

**Why this priority**: It matches how NetClaw itself is built, and it gives teams reviewable, committable deployment intent.

**Independent Test**: Scaffold a deployment workspace for each assistant. Run specify, then plan, then submit. Apply in a fixture home. Confirm that results are written back and that no secrets appear anywhere in the workspace.

**Acceptance Scenarios**:

1. **Given** the Spec option, **When** chosen, **Then** a separate deployment workspace outside the NetClaw checkout is scaffolded. It contains Spec Kit initialized for the chosen assistant and a NetClaw claw preset (templates and safety principles).
2. **Given** that workspace, **When** the user specifies and plans, **Then** the deployment spec captures the claw's purpose, domains, devices, channels, posture and shape, and the plan step produces a Claw Plan with rationale. "Implement" means submitting the plan to the human review and applying it.
3. **Given** verification, **When** it completes, **Then** the Claw Report is recorded back into the deployment workspace.
4. **Given** the deployment workspace, **When** committed, **Then** it contains no secret values.
5. **Given** an updated deployment plan for an existing installation, **When** submitted, **Then** the extension explains that plan-driven changes to existing installations are a follow-up feature, and points to existing per-integration setup (Spec 151).

---

### User Story 10 - CLI parity: the DOS way speaks Claw Plan (Priority: P2)

CLI users keep everything they have today and gain plan files, so a plan from any pathway can be applied anywhere.

**Why this priority**: Backward compatibility is constitutional. Plan interchange is what keeps the pathways honest.

**Independent Test**: Run the existing installer regression suite unchanged. Save a plan from the TUI and apply it in the wizard. Save a plan from the wizard and apply it with the CLI. Compare manifests, registrations and readiness results.

**Acceptance Scenarios**:

1. **Given** existing flags, the TUI, manifests and outputs, **When** used as before, **Then** they behave as before.
2. **Given** the TUI review point, **When** the user chooses to save, **Then** the selections are written as a Claw Plan.
3. **Given** a plan file, **When** applied with the CLI, **Then** secrets are prompted on the terminal, apply requires interactive confirmation, and a validate/explain-only mode is available.
4. **Given** a plan produced by any front-end, **When** applied by any other, **Then** the results are equivalent.
5. **Given** the catalog migration, **When** `--list` runs, **Then** its content is unchanged apart from intentional additions.

---

### User Story 11 - Every choice explains itself (Priority: P1)

Wherever a user meets a component, skill, profile or member option, the same trustworthy description, requirements and links appear.

**Why this priority**: The cards, the Shape Advisor and the assistant tools all depend on this data, so it is the foundation of the feature.

**Independent Test**: Validate catalog completeness for every baseline component and deployable skill. Render every card. Answer catalog queries through the assistant tools. Run the link checker. Compare TUI output before and after the migration.

**Acceptance Scenarios**:

1. **Given** the catalog, **When** validated, **Then** every installer component (110 at baseline) and every deployable skill (238 at baseline) has: name, category, plain-language description, kind, supported platforms, prerequisites, settings fields with secret classification, an estimated tool count, read/write posture, related skills and MCPs, member-profile mapping, and documentation links. At least one link is NetClaw documentation. Vendor and upstream links are included wherever they exist; otherwise an explicit reason is recorded.
2. **Given** a component, **When** shown in the wizard, returned by an assistant tool or listed by the TUI, **Then** the same catalog data is used.
3. **Given** CI, **When** metadata is missing, malformed or joined to an unknown ID, **Then** the change is rejected. A scheduled link check reports dead links without blocking unrelated work.
4. **Given** the known join mismatches (card IDs versus installer IDs, and the duplicate Catalyst Center field declarations), **When** the catalog is built, **Then** each is resolved by an explicit, documented mapping.

---

### User Story 12 - Clean up an abandoned new install (Priority: P3)

A user who gives up partway through can remove what this setup created, and nothing else.

**Why this priority**: Recovery for non-experts matters, but deletion must come last and be tightly scoped.

**Independent Test**: Abandon runs at several phases in fixture homes that contain pre-existing files and credentials. Run cleanup. Confirm that only journaled, run-created artifacts were removed and that pre-existing content is byte-identical.

**Acceptance Scenarios**:

1. **Given** an abandoned run, **When** **Clean up this setup** is chosen, **Then** a native review lists every item this run's journal records as created by it. Pre-existing items are excluded and never touched.
2. **Given** cleanup, **When** it finishes, **Then** per-item outcomes are reported, logs are optionally kept, and credential files that existed before the run are untouched.

---

### Edge Cases

- From Windows, the window is opened on a `\\wsl$` or `\\wsl.localhost` path, which is not a WSL remote. Explain the difference and offer **Reopen in WSL**.
- The extension is installed locally but not yet in WSL after the reopen. Guide the in-WSL install.
- The host is Windows on ARM64, Apple silicon or Intel macOS, or runs under Rosetta. Prerequisites and component availability must reflect the actual architecture.
- A corporate proxy, TLS interception, blocked GitHub or a GitHub API rate limit applies. Fall back to git tag discovery and give actionable guidance.
- `main` requires a newer extension, or the installed extension is newer than the checkout's engine protocol.
- Disk space is low, the connection is slow or metered, or downloads are large (local models, Docker images).
- `~/.openclaw`, `~/.hermes` or `~/netclaw` already exist, with or without local changes.
- Multiple claws use the same harness, share a display name or source checkout, or compete for ports/service names. Installation identity must remain unambiguous; collisions require a reviewed alternative or a stop, never takeover of another claw's resources.
- An existing runtime is stopped or unreachable, or an unregistered installation is encountered at a selected home. Missing health evidence is not evidence that its files or resources are unused.
- Node comes from a version manager at the wrong version, several Pythons are installed, or the system Python is externally managed (PEP 668).
- Harness-native onboarding is cancelled or left partial, or the harness's upstream CLI changed (`openclaw@latest` drift).
- A Risk member overrides the Border's harness, or a Border harness change invalidates inherited member choices. Unsupported member profiles, integrations or production controls must be identified for the affected claw rather than inferred from another claw's capabilities.
- A local model is not downloaded, the machine lacks the memory for it, or the local model service is not running.
- A cloud key is invalid or rate-limited, or the verification call incurs cost.
- A channel token is invalid, or the chat app is not installed in its workspace.
- Interactive components (`checkpoint`, `forward`, `ipfabric`, `threejs-viz`, `jev`) are selected.
- Linux-only components are selected on macOS.
- Risk production mode is chosen on a host without its service manager or security controls: macOS launchd versus `systemd --user`, or WSL without systemd enabled.
- Required production controls disappear after review or during an interrupted run. Apply/resume must stop pending verified controls or an explicit posture change and fresh review; a previously granted review cannot authorize an automatic downgrade.
- An assistant puts a literal secret in a plan, uses an unknown component ID, relies on a stale catalog, or submits a plan with an unsupported schema version.
- Two VS Code windows run setup at once, or the CLI and the wizard target the same home.
- The editor reloads during secret entry. Secrets are never persisted for resume, so they are re-prompted.
- The owning VS Code window closes while a download, component installer or native onboarding process is active. Pause-requested and verified-paused are distinct; abrupt loss or surviving child processes require observation before resume, and no later installation phase continues unattended.
- A report's error text, nested evidence reference or URL embeds a hostname, IP address, username or local path. Default export must redact these locations too; detailed export consent never permits secret or token disclosure.
- Setup starts in an empty window, which is the primary zero state, or in a folder that is not trusted. Setup is host-level, so it MUST work in an empty window, and in an untrusted folder it must explain the trust requirement or offer an empty window.

## Requirements *(mandatory)*

### Functional Requirements

#### Entry and platform

- **FR-001**: The extension MUST offer **Set Up a New Claw** from the NetClaw view, the Command Palette and a new VS Code walkthrough. These MUST be available with no existing installation and in an empty window. Opening the extension MUST NOT change the host.
- **FR-002**: The extension MUST classify the setup host as macOS, WSL2 Linux, native Windows or other. Only macOS and WSL2 MAY proceed to installation in this feature. Other hosts MUST be told that zero-install is not yet qualified there, while existing connection management continues unchanged.
- **FR-003**: On native Windows the extension MUST perform only read-only detection of WSL enablement, WSL version, installed distributions and the VS Code WSL extension. If any WSL prerequisite is unmet, it MUST hard-stop with the specific unmet condition, official guidance links and the NetClaw Windows prerequisites guide. It MUST NOT enable features, elevate, reboot, install distributions or download software.
- **FR-004**: When the WSL prerequisites are met, the extension MUST offer to reopen in a selected supported distribution and MUST resume setup there with previously entered non-secret choices. Secret values MUST NOT cross that handoff.
- **FR-005**: Prerequisite checks MUST derive required versions from the repository's declared policies (`config/installer-runtime.json`, `config/installer-preflight.json`) for the selected source when it is available, and from a bundled baseline before acquisition. Each check MUST report observed versus required values, the reason, a documentation link and a remedy.
- **FR-006**: Automatic remedies MUST be fixed, reviewed commands for supported package sources, executed in a visible terminal where OS passwords are typed only by the user. They MUST NOT replace runtimes managed by a detected version manager without an explicit choice, MUST NOT run npm under sudo, and MUST re-check after running.

#### Source

- **FR-007**: The source step MUST offer **Latest release** (default) and **Main** from `github.com/automateyournetwork/netclaw` only. It MUST show the resolved tag or commit, its date, the notes or commit link, and extension compatibility.
- **FR-008**: Destination selection MUST refuse non-empty folders that are not NetClaw checkouts. It MAY reuse an existing checkout as-is after review. It MAY update a clean checkout only after review and verification that it does not serve an existing installation; otherwise an update MUST use a separate source destination. It MUST NOT reset, overwrite or discard local changes. Source reuse MUST NOT authorize reuse of an existing runtime home.
- **FR-009**: The checkout's origin, ref and commit MUST be verified before any repository code executes. The source identity MUST be recorded in the setup run and in the installation identity.
- **FR-010**: The extension MUST refuse to drive a checkout whose engine protocol version is outside its supported range, and MUST explain the available options.

#### Guided tree and cards

- **FR-011**: The tree order MUST be platform → source → harness → provider/model → channels → shape → capabilities → settings → inventory → identity/posture → review. It MUST be shown as a navigable tree with visible branches. Changing a prior answer MUST show its downstream impact before anything is discarded.
- **FR-012**: Provider, model and channel options MUST come from each affected claw's selected harness's supported interfaces and the catalog, recorded with its observed harness version. Member profiles and capabilities MUST also be validated against the member's own harness. The wizard MUST NOT offer options that harness cannot configure or infer support from the Border or another member.
- **FR-013**: Every option card MUST use the Spec 151 card theme and show purpose, when to choose it, platform support, prerequisites, required settings and documentation links. Links MUST open only on user action through VS Code's external-link handling. Rendering a card MUST NOT trigger an external fetch.
- **FR-014**: Copy MUST default to plain language, with a glossary for MCP, skill, harness, provider, channel, Border, member, Risk and testbed. A "Recommended" marker MUST appear only where a documented rule supports it.
- **FR-015**: Capability selection MUST support starting from existing profiles, per-card refinement, search and filtering, dependency explanations, and platform incompatibility shown as disabled with a reason.
- **FR-016**: The Local provider path MUST detect the local model runtimes the harness supports and list their installed models. It MUST disclose download size and hardware needs before any model download and require explicit consent.
- **FR-017**: "No channels" MUST be a fully supported outcome.

#### Shape and Risk

- **FR-018**: The Shape Advisor MUST compute focused versus Risk estimates from catalog data and documented thresholds. Inputs are tool counts, MCP count, skill count and credential trust domains. It MUST present a recommendation with reasons, label estimates as estimates, and never force a choice.
- **FR-019**: A Risk in this feature MUST be one Border and one or more members on the same host using iN2N. eN2N and multi-host members MUST be shown as unavailable in this version, with a documentation link.
- **FR-020**: The Border MUST carry gateway, channels, routing, audit and memory and no domain skills. A single-host Risk MUST support OpenClaw and Hermes selected independently for the Border and each member, subject to verified compatibility. Members MUST default to inheriting the Border's harness and allow an explicit supported override. Members MUST be built from profiles valid for their own harness, selected capabilities and configured backends. Each member MUST declare a name, resolved harness and whether it is inherited or overridden, profile, provider/model and hot or on-demand mode. Plan review and verification MUST identify each claw's resolved harness; unsupported combinations MUST be unavailable with a reason.
- **FR-021**: Each member MUST receive only the secrets its integrations require. The review MUST show each member's secret scope by key name only.
- **FR-022**: Member enrollment MUST be automated with single-use tokens that never appear in plans, assistant context, logs or evidence.
- **FR-023**: Requested production mode MUST require verified controls for the host and every selected claw. If any required control is missing, unsupported or unverified, setup MUST stop before apply/resume, retain the requested posture and explain the affected controls and claws. It MAY continue only after successful control verification or the user's explicit choice of testing mode followed by a revised plan and fresh review. Setup MUST NOT automatically downgrade posture. The reported posture MUST reflect the controls actually present afterward.

#### Settings and secrets

- **FR-024**: Settings forms MUST show only fields for selected components. Each field MUST show its label, required or conditional status, secret classification, example and shared use. Optional fields MUST offer **Configure later**.
- **FR-025**: Secret values MUST be entered only in native secret inputs (wizard) or the engine's terminal prompt (CLI). They MUST be transmitted to the engine over a private channel, never through command-line arguments, inherited environments of unrelated processes or temporary files. They MUST be persisted only through existing private writers (owner-only permissions) to the selected runtime environment file or a member-scoped environment file.
- **FR-026**: Plans MUST contain secret references only. Validators MUST reject literal secret values using field classification and value patterns. Unknown fields MUST be treated as confidential by default.
- **FR-027**: No secret value, enrollment token or private credential MAY appear in plans, assistant tool inputs or outputs, webview state, logs, journals, evidence, reports or committed artifacts.

#### Claw Plan and setup engine

- **FR-028**: The Claw Plan MUST be a single versioned, schema-validated, human-readable document. It MUST capture every tree choice, the source ref, the target host class and the selected verification tiers, and MUST have a deterministic content hash.
- **FR-029**: The setup engine in the checkout MUST provide validate, explain (effects disclosure), apply, resume, status and verify operations. It MUST emit a machine-readable event stream that all front-ends consume.
- **FR-030**: Apply MUST require a review bound to the plan hash, target host and runtime home: the native VS Code review in the wizard, or interactive confirmation in the CLI. Any plan change after review MUST invalidate the review.
- **FR-031**: Apply MUST reuse the existing installer core and component install functions. Installation behavior for a given component MUST be equivalent across pathways.
- **FR-032**: Harness onboarding MUST use each claw's selected harness's supported non-interactive interfaces where they exist. Otherwise it MUST run the native interactive step visibly and verify that claw's resulting configuration before continuing. Onboarding or verification of one harness MUST NOT count as evidence for another claw or harness.
- **FR-033**: The engine MUST journal each phase before and after its effects in private storage, support explicit resume from the last verified phase, never blindly replay unknown outcomes, and enforce one active run per runtime home. When the owning VS Code window closes, reloads or disconnects, a wizard-owned run MUST request a pause, start no later phase once the disconnect is detected, and reach the next safe checkpoint for in-flight work where possible. It MUST distinguish pause-requested, verified-paused and unknown outcomes, preserve exclusive ownership while any owned writer remains active, and offer Resume without automatically continuing when the editor returns. Resume MUST observe unresolved effects and revalidate review, target ownership and required controls; unavailable secrets MUST be re-prompted. Pausing setup MUST NOT stop already installed claw services, and unrelated editor closure MUST NOT pause a separately owned CLI run.
- **FR-034**: New-claw provisioning MUST use a new, empty runtime home and MUST NOT modify an existing installation's runtime home, configuration, credentials, identity or services. It MUST revalidate the target before applying and refuse if it has become occupied. Source checkout reuse/update follows FR-008. Managing an existing claw is a separate selected-installation workflow, not a new-installation plan.
- **FR-035**: Component failures MUST be isolated and reported with logs and retry, using the existing readiness vocabulary (`failed`, `configuration_required`, `discovery_verified`, `unverified`).

#### Verification and handoff

- **FR-036**: Verification MUST implement the tiers defined in User Story 6. Opt-in tiers MUST disclose cost and external effects. Channel test messages MUST each be individually approved (Constitution XIV). The network tier MUST be read-only.
- **FR-037**: The Claw Report MUST show per-tier and per-component states (verified, failed, `configuration_required`, skipped, unverified) and MUST NOT display success for unverified items. Default exports MUST redact hostnames, IP addresses, usernames and local paths, including nested fields, free-text errors, URLs and evidence references. A detailed export MAY include these private identifiers only after explicit human review of that export. Both formats MUST be saved locally, always exclude secrets and enrollment tokens, retain useful outcomes and provenance, and never transmit automatically.
- **FR-038**: Once Tier 3 is verified, the extension MUST offer a saved connection through the existing identity review and then open the Workbench.
- **FR-039**: Verification MUST be re-runnable later from the saved connection.

#### Assistant pathways

- **FR-040**: The extension MUST expose provisioning-mode setup tools to Copilot (through its MCP server definition provider) and to Claude Code and Codex (through reviewed registration). These MUST work without a bound installation and without host Node being installed.
- **FR-041**: Setup tools MUST be limited to: platform and prerequisite observation; catalog search and explanation; plan draft, validate and explain; secret-entry requests that return only presence; submitting a plan for human review; and read-only run and verification status with redacted summaries. No tool MAY apply a plan, execute arbitrary commands, read secret values or write outside the plan location the user chose.
- **FR-042**: One cross-harness install skill MUST encode the tree, question order, plan guidance, safety rules (no secrets, stage rather than execute, never invent IDs) and starter prompts for the Q&A and Intent modes. It MUST have a single, version-stamped source and be distributed to each harness's supported skill location only with consent.
- **FR-043**: Intent mode MUST return a plan with explicit assumptions and unresolved gaps. Required decisions MUST NOT be silently defaulted.
- **FR-044**: Terminal-harness guidance MUST stage state-changing commands for the human. Documentation MUST state that harness permission settings, not NetClaw, govern what a terminal agent can execute.
- **FR-045**: The Spec pathway MUST scaffold a deployment workspace outside the NetClaw checkout, with Spec Kit initialized for the chosen assistant plus a NetClaw claw preset. Its plan step MUST produce a Claw Plan, its implement step MUST submit to human review, and results MUST be written back. Plan-driven changes to an existing installation are out of scope.

#### CLI parity

- **FR-046**: All existing `install.sh` flags, TUI flows, manifests and outputs MUST keep their behavior. New options MUST add plan emit, validate/explain and apply without altering existing semantics. `scripts/install.sh` MUST remain a thin dispatcher.
- **FR-047**: Plans produced by any front-end MUST be accepted by every other front-end.

#### Canonical catalog

- **FR-048**: A canonical component catalog MUST be the single source of components, profiles, member-profile mapping, settings metadata and documentation links for the TUI, wizard, engine and assistant tools. `scripts/lib/catalog.sh` compatibility MUST be preserved.
- **FR-049**: CI MUST validate catalog completeness, schema, joins and link syntax. A scheduled check MUST report dead links.
- **FR-050**: Skill cards MUST link to their `SKILL.md` and to the MCPs they require.

#### Cleanup, accessibility, privacy and documentation

- **FR-051**: Cleanup (User Story 12) MUST be restricted to artifacts this run's journal records as created by it, and MUST require native review.
- **FR-052**: All setup surfaces MUST be keyboard-operable, MUST support light, dark and high-contrast themes, a 360-pixel panel width and 200% zoom, and MUST expose accessible names for every control.
- **FR-053**: The feature MUST add no telemetry. External requests MUST be limited to user-started actions (source acquisition, prerequisite remedies, downloads, verification), and each MUST be disclosed in review.
- **FR-054**: Documentation MUST include: a README "Three ways in" section, a VS Code getting-started guide, a Windows/WSL prerequisites guide, a Claw Plan reference, assistant guides (Copilot, Claude Code, Codex), a Spec Kit guide, example intent prompts, the extension README and the walkthrough.
- **FR-055**: Setup MUST perform read-only detection of existing claws using registered installation metadata and known or user-selected locations, state the scope and limits of detection, and clearly disclose that continuing creates a separate installation. It MUST offer management of a detected existing claw or a new-claw path with distinct identity, runtime home, credential scope, service ownership and non-conflicting endpoints. Detection MUST NOT expose secret values or infer that an unreachable installation is absent.
- **FR-056**: The extension MUST retain and manage multiple claw installations on the same host through distinct saved connections. The selected installation's identity, harness and runtime home MUST be visible, and existing configuration, workspace and lifecycle controls MUST target only that installation. Connections, in-flight operations and cached state MUST remain installation-scoped. New-claw provisioning MUST preserve other installations and their saved connections, including when they use the same harness. Bulk changes across installations are not implied.

### Key Entities

- **Claw Plan**: versioned, secret-free intent covering source, host class, the focused claw or Border harness and each member's resolved harness/inheritance choice, providers/models, channels, shape, capabilities, settings references, inventory, identity/posture and verification tiers. It has a deterministic hash.
- **Setup Host**: the observed platform class, architecture, OS version and extension host context.
- **Installation Identity**: stable identity for one claw on a host, associated with its display name, harness, runtime home, source identity, owned services/endpoints and saved connection. Display names alone are not unique identifiers; detection evidence and current health are separate.
- **Prerequisite Check**: observed value, required value, reason, documentation link, remedy and outcome.
- **Source Selection**: channel (release or `main`), resolved ref and commit, destination and verification result.
- **Component Descriptor / Skill Descriptor**: canonical catalog entries with platforms, prerequisites, settings fields, tool estimate, posture, joins and documentation links.
- **Shape Recommendation**: the inputs, estimates, thresholds applied, recommendation and reasons.
- **Member Definition**: name, resolved OpenClaw or Hermes harness, inherited or explicit harness selection, profile, provider/model, hot or on-demand mode, and secret scope by key name. Compatibility and observed runtime version belong to this member's selected harness.
- **Secret Reference**: key name, owning claw or member, classification and source (prompt, existing or later). It never holds a value.
- **Review Token**: binds the plan hash, host, runtime home and reviewer action. It is invalidated by any change.
- **Setup Run**: a journaled execution with its owning front-end session, phase records, the lock, outcomes and evidence locations. Pause-requested, verified-paused and unknown are distinct states; verified pause requires no active owned writer, and resume requires an explicit user action and observation of unresolved effects.
- **Claw Report**: per-tier and per-component verification states, with timestamps and evidence references. Local evidence can retain private non-secret identifiers; the default export removes them. An explicitly reviewed detailed local export may retain them. Neither export contains secrets or enrollment tokens.
- **Assistant Registration**: the provisioning-mode tool access granted to a specific assistant on a specific host, with consent and version.
- **Deployment Workspace**: the Spec Kit folder holding a deployment spec, the Claw Plan and the recorded Claw Report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean macOS host and on a clean WSL2 Ubuntu host, a first-time user reaches a Claw Report with Tiers 1–3 verified for a focused claw using only the wizard. They type no shell commands other than OS passwords and harness-native onboarding prompts where no non-interactive interface exists.
- **SC-002**: Run repeatable synthetic usability scenarios plus an owner/build-agent walkthrough for focused-claw setup, shape selection/override, existing-claw detection, multiclaw management, cancellation/resume and the Claw Report. Record completion, assistance, accessibility and timing evidence separately for synthetic and owner exercises; distinguish fixture, local and live verification tiers. Record community feedback after release as follow-up. No recruited-participant count or unaided human success rate is claimed. This replaces the five-participant study by explicit owner instruction on 2026-10-18; other verification and performance criteria remain unchanged.
- **SC-003**: On every Windows gate configuration in the matrix, setup hard-stops or proceeds exactly as specified, with zero system changes in before/after host snapshots. After **Reopen in WSL**, 100% of non-secret answers are restored.
- **SC-004**: The same plan applied through the wizard, the CLI and each assistant pathway yields equivalent component manifests, registrations, skill deployments and readiness results. Differences are limited to timestamps, run IDs and paths.
- **SC-005**: Across the full matrix, privacy checks find zero secret values or enrollment tokens in plans, assistant transcripts and tool payloads, webview state, logs, journals, evidence, reports and committed artifacts. The validator rejects 100% of seeded literal secrets. Default report exports contain zero seeded hostnames, IP addresses, usernames or local paths, including values embedded in errors, URLs and nested evidence references. Detailed exports require recorded review, remain local and pass the same zero-secret checks.
- **SC-006**: 100% of baseline components and deployable skills have complete catalog entries. The TUI `--list` content is unchanged apart from intentional additions. The scheduled link check reports zero unexplained dead links at release.
- **SC-007**: Every injected interruption (network loss, editor reload/window close, host reboot, cancelled native step, failing component, concurrent run) produces a resumable or explicitly unknown state. After detecting loss of the owning editor, wizard-owned runs start zero subsequent phases, and reopening performs no further installation until explicit Resume. Clean pauses are verified; abrupt termination and surviving writers remain unresolved until observed. There is no false success, false paused state or duplicated completed phase, and no answered question is re-asked except secrets. Already installed claw services and independently owned CLI runs are unaffected by editor closure.
- **SC-008**: For each supported Border harness, a single-host Risk with at least three members using both OpenClaw and Hermes and at least two different providers reaches verified enrollment and a routed self-status for every hot member. Evidence covers all four Border/member harness pairings, inherited and overridden choices, and per-member secret isolation. Unsupported combinations are refused with reasons, and reported posture matches the controls actually present for every claw. In every injected missing-control case before apply or resume, production setup stops with zero automatic downgrades; proceeding in testing mode requires an explicit user choice and fresh review of the revised plan.
- **SC-009**: In every assistant pathway run, zero tool calls apply a plan, execute arbitrary commands or receive secret values, and every apply is attributed to a human review action.
- **SC-010**: The Shape Advisor shows numeric estimates and reasons for 100% of tested selections, and the user's override always succeeds.
- **SC-011**: All primary setup workflows pass keyboard-only checks in light, dark and high-contrast themes, at a 360-pixel panel width and at 200% zoom.
- **SC-012**: The existing installer regression suite and the existing extension management workflows pass unchanged. During new-claw provisioning, pre-existing installation files remain byte-identical and their service state and saved connections remain unchanged.
- **SC-013**: With the reference profile `minimal` on reference hardware and network, the median wizard decision time is under ten minutes. Total time to Tier 3 is measured and published, with downloads reported separately.
- **SC-014**: On each qualified installation platform, create and manage at least two claws on one fixture host, including a same-harness pair. Existing-claw detection and the separate-installation disclosure appear in every applicable case. Every tested configuration, workspace and lifecycle operation affects only its selected installation; occupied homes and resource collisions never overwrite, stop or reconfigure another claw.

## Assumptions

- Acceptance amendment (2026-10-18): the owner chose owner/build-agent synthetic usability testing, with devoted users providing natural feedback after release, instead of recruiting five pre-release non-CLI participants. SC-002 and T083 reflect this decision. It does not waive actual Mac/WSL qualification, live verification prerequisites or any safety/postcondition requirement. Complete Mac work first, provide a WSL handoff with a return-evidence contract, then review returned results before publication and the recording.

- Workflow authorization (2026-10-17): the owner requested a new Spec Kit cycle on a new branch: specify from the supplied inputs, clarify five points interactively, plan, tasks, analyze and address all findings before proceeding, then implement and test. This authorizes progression through G1 and G2 in that order once clarification and analysis are complete, superseding the kickoff's earlier instruction to stop at G2. Milestone evidence must still be reported; G3 preview and the separate packaging, push, handoff and publication boundaries remain applicable. This is workflow authorization, not approval of unanswered product decisions or permission to touch real installations.
- Owner decisions from 2026-10-17 are recorded in Clarifications and are binding for planning.
- The setup host is the extension host: the Mac itself, or the WSL2 distribution after reopening. Installing onto a different remote machine from a local window is out of scope.
- Supported WSL distributions are Ubuntu LTS releases named during research. Others hard-stop with guidance.
- Harness-native onboarding (`openclaw onboard`, `hermes setup`) remains authoritative for provider, gateway and channel configuration wherever no supported non-interactive interface exists. The wizard orchestrates and verifies; it does not reimplement harness internals.
- Plan-driven modification of an existing installation, multi-host members, eN2N peering, native Windows hosting, browser-based VS Code, and zero-install on other Linux or Remote SSH hosts are follow-up work.
- GitHub Spec Kit is the only spec kit supported in this feature. An adapter seam for others is documented, not implemented.
- The minimum supported VS Code version may rise to support assistant features. Existing management features continue on the current minimum where feasible, or the planning research documents the change.
- No telemetry is added. The extension remains under its current license and privacy policy.
- Development, acceptance and qualification use isolated fixture homes and disposable hosts. Nothing touches the owner's real `~/.openclaw`, `~/.hermes` or checkouts.
- Pushing, merging, packaging for release and Marketplace publication require separate owner authorization, recorded later in this section.
