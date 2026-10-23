# Feature Specification: NetClaw Flagship Audit and Remediation

**Feature Branch**: `124-flagship-audit`

**Created**: 2026-09-26

**Status**: Implementation and verification in progress

**Input**: Audit the current project end to end; fix security flaws and warranted performance, reliability, code-quality, skill, and documentation defects. Preserve behavior where practical; justify breaking changes and ship explicit migration scripts. Follow SpecKit specify → interactive clarify → plan → tasks → analyze → resolve findings → implement. Reserve spec 125 for the HUD redesign and phase 3 for documentation and upgrade delivery.

## Clarifications

### Session 2026-09-26

- Q: Which host platforms are release requirements? → A: macOS, Linux, and Windows through WSL2. Native Windows is not a supported full NetClaw host (pyATS does not run there); support remains limited to existing Windows-capable components.

- Q: Are breaking changes permitted? → A: Yes for security or sufficiently justified fixes; each must include an explicit migration script for users.
- Q: What verification environments are available? → A: John can provision sandboxes, CML, ServiceNow, NetBox and other labs when concrete requirements are known; local Docker FRR and suitable lab tooling are allowed. Blender/Unreal testing may require his Windows machine.
- Q: May this Mac be reinstalled? → A: A fresh NetClaw installation is authorized if necessary, with a working installation restored at the end. Preserve user data and recovery options; first test in isolated environments.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand and remove project risks (Priority: P1)

As a maintainer, I need an evidence-based view of the entire shipped project and verified remediation of identified security and correctness defects.

**Why this priority**: NetClaw can reach sensitive infrastructure; misleading state, unsafe authorization, or credential exposure can cause operational harm.

**Independent Test**: Review the repository coverage inventory and reproduce representative findings and their regression checks without production access.

**Acceptance Scenarios**:

1. **Given** the starting repository revision, **When** the audit runs, **Then** every tracked area is classified, its review method and evidence recorded, and excluded/generated/external areas have explicit reasons.
2. **Given** a confirmed defect, **When** remediation is reported as verified, **Then** the finding identifies its cause, affected paths, fix, and passing verification evidence.
3. **Given** missing credentials or an unavailable service, **When** a check cannot run, **Then** it is reported as unverified with a concrete environment request, never as a pass or empty inventory.

### User Story 2 - Trust normal and failure behavior (Priority: P1)

As an operator, I need installation, chat, routing, tools, and safety controls to behave correctly on successful, failed, and adversarial inputs.

**Why this priority**: A successful happy-path demo cannot establish trustworthy network automation.

**Independent Test**: Exercise representative operator journeys and negative cases in isolated environments, with explicit evidence of which boundaries were tested.

**Acceptance Scenarios**:

1. **Given** an operation lacking required authority, **When** it is requested through a supported entry point, **Then** it is refused before the protected side effect and the result is accurately reported.
2. **Given** a failed or partial integration response, **When** it is shown to an operator, **Then** failures, empty data, stale data, and partial results remain distinguishable.
3. **Given** an identified performance bottleneck, **When** it is optimized, **Then** before/after measurements on the same documented workload demonstrate the claimed improvement without losing correctness.

### User Story 3 - Adopt fixes without losing an installation (Priority: P1)

As an existing user, I need justified breaking fixes to include a safe, explicit migration path that preserves my configuration and data.

**Why this priority**: Security fixes are ineffective if upgrading breaks the installation or destroys local knowledge.

**Independent Test**: Run each migration against a representative old installation fixture and verify completion, repeat invocation, failure handling, and restoration.

**Acceptance Scenarios**:

1. **Given** a breaking fix, **When** a user reviews it, **Then** its rationale, affected versions/configuration, prerequisites, migration command, backup, and recovery procedure are documented.
2. **Given** an applicable migration, **When** it is previewed and run, **Then** it shows intended changes, preserves secrets and user-owned content, and verifies the resulting state.
3. **Given** interrupted, already-applied, unsupported, or locally modified state, **When** a migration runs, **Then** it resumes safely or stops with actionable guidance without silent overwrite.

### User Story 4 - Continue development with traceable evidence (Priority: P2)

As a contributor, I need reproducible checks, coherent documentation, and a handoff connecting each finding to its resolution.

**Why this priority**: Improvements must survive new contributions and context resets.

**Independent Test**: A fresh session can identify the branch, decisions, verification commands, completed tasks, outstanding work, and next action from the handoff alone.

**Acceptance Scenarios**:

1. **Given** an audit finding, **When** work is complete, **Then** it links to its requirement, task, remediation and verification, or an explicitly unresolved blocker.
2. **Given** a completed phase, **When** context is cleared, **Then** a persisted handoff and audit record preserve the state and user decisions.

### Edge Cases

- Optional integrations unavailable, missing credentials, rate limits, timeouts, or incompatible dependencies.
- Partial installations, multiple runtimes, stale generated artifacts, local modifications, and mixed component versions.
- Interrupted migrations, insufficient disk space, failed backup/restore, and repeat invocation.
- Untrusted chat, retrieved documents, meeting content, tool output, filenames, URLs, and federation peers.
- Platform-specific functionality that cannot honestly be validated on this Mac.
- Conflicting project instructions, stale skills, unsupported claims, and inconsistent inventory counts.
- Findings discovered after planning: update spec/plan/tasks, repeat analysis, then implement within the approved objective.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Audit MUST record the starting revision and working-tree state and maintain a coverage matrix for all tracked repository areas, including first-party and contributed code, vendored integration boundaries, scripts, configuration, dependencies, CI, tests, skills, specifications, and documentation.
- **FR-002**: Findings MUST have stable identifiers, severity, evidence, affected paths, user impact, disposition, and verification status. Suspicions MUST be distinguished from confirmed defects.
- **FR-003**: Security review MUST cover authentication, authorization, change approval, secrets, injection, path traversal, outbound request boundaries, untrusted content, transport, dependency risks, and audit integrity where applicable.
- **FR-004**: Audit MUST cover startup/install, runtime/tool dispatch, Border/member/federation behavior, chat channels, RAG and memory, GCF, mobile/watch, Zoom, HUD, and advertised integrations. Per-area evidence MUST distinguish source review, automated tests, simulated integration, and live validation.
- **FR-005**: Confirmed security and correctness defects MUST receive fixes and appropriate regression verification. Unresolved defects MUST remain visible and MUST prevent an unqualified completion claim.
- **FR-006**: Quality and performance improvements MUST state their concrete benefit. Quantified performance claims MUST have reproducible before/after measurements; no arbitrary speedup claim is acceptable.
- **FR-007**: Breaking changes MUST document why compatibility cannot reasonably be retained and include executable migration scripts, preview/preflight behavior, backup and restoration guidance, repeat-run safety, and post-migration verification.
- **FR-008**: Tests MUST use isolated resources by default. Required live laboratories MUST be requested with exact topology/service/version needs and intended operations. Production device changes remain subject to existing change management and baseline requirements.
- **FR-009**: Local installation replacement, if required, MUST preserve credentials, configuration, knowledge stores, conversations, audit records, and other user-owned state with verified recovery. Final installation health MUST be checked.
- **FR-010**: Changed capabilities MUST update their associated installation/configuration, skills, operational references, and user documentation in the same phase. Existing malformed README content affecting changed guidance MUST be corrected; the comprehensive editorial rewrite belongs to phase 3.
- **FR-011**: Every meaningful work milestone MUST be recorded in GAIT, with daily session notes and a phase handoff. Unavailable audit or memory services MUST be reported honestly and recovered where feasible.
- **FR-012**: SpecKit artifacts MUST trace requirements to tasks and evidence. Analysis findings MUST be resolved before implementation; newly introduced cross-artifact inconsistencies MUST trigger another analysis pass.
- **FR-013**: Additions are permitted where they address an evidenced audit gap or improve a documented operator/contributor journey. They MUST be added to the specification and task plan before implementation.
- **FR-014**: The release verification matrix MUST specify required host platforms and component-specific exceptions. Required hosts are macOS, Linux, and Windows through WSL2. Native Windows remains scoped to components that already support it; unavailable platform tests MUST never be represented as completed.

### Key Entities

- **Coverage entry**: Repository area, scope, method, reviewer/session, evidence, and remaining limitations.
- **Finding**: Stable identifier, classification, severity, reproduction, user impact, remediation and verification links.
- **Migration**: Applicability, affected state, preview, backup, execution, verification and recovery contract.
- **Verification record**: Revision, environment, command/procedure, result, evidence location, and limitations.
- **Phase handoff**: Branch/revision, user decisions, completed work, pending work, test evidence, environment needs, and next SpecKit step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tracked repository areas have a coverage disposition; external dependencies and generated content have explicit boundary statements.
- **SC-002**: Every confirmed finding has an evidence-backed disposition. Phase completion requires no unresolved confirmed security or correctness defects in the reviewed scope; missing evidence remains explicitly outstanding.
- **SC-003**: Every breaking change includes a migration tested for normal completion, repeated execution, failure handling, and recovery on representative preserved state.
- **SC-004**: Every claimed performance improvement has reproducible measurements and associated correctness verification.
- **SC-005**: All required checks for modified areas pass; broader baseline failures are triaged, tracked and resolved or reported as blockers, never silently omitted.
- **SC-006**: Every advertised major capability has an audit entry and an honest verification status; each required but unavailable live check has a concrete laboratory request.
- **SC-007**: Every requirement maps to tasks and verification, and cross-artifact analysis has no unresolved findings before implementation begins.
- **SC-008**: The next session can resume from the handoff without reconstructing decisions from chat history.

## Assumptions

- This spec covers the audit and its remediation, not the full HUD redesign reserved for 125.
- Existing behavior is preserved unless security or another documented substantial reason warrants change; John has authorized such changes with migration scripts.
- The feature number is explicitly 124 as requested by John, overriding automatic numbering guidance.
- The existing repository uses `specs/`; constitution 1.2.1 corrects its stale `.specify/specs/` reference with no policy change.
- Formal update/upgrade orchestration is phase 3a, preceding the final README review in phase 3b. Migrations required by spec 124 ship with their fixes and do not wait for phase 3a.
- Phase 125 will serve new and experienced network engineers, consider Beginner/Advanced modes, preserve Adam Mason's context chat with modest integration adjustments, and retain Border/NetClaw chat.
- Phase 3b will explicitly cover RAG, iPhone/watch, Zoom, and GCF, with claims checked against implementation and a rendered Markdown review.
- Isolated local setup is authorized. External communications/publication are not implied by repository-edit permission.
- Required host platforms are macOS, Linux, and WSL2; tests requiring unavailable services or hardware will be requested when their concrete need is known.

## Bounded closeout amendment — 2026-09-27

Explicit user direction supersedes exhaustive-review scope: finish confirmed001–103 repairs and final checks, triage remaining evidence for safe-use blockers, and defer unreviewed paths in [deferred-review.md](deferred-review.md). Only confirmed security, data-loss or installation/runtime failures preventing safe use extend this phase. Spec125 remains the HUD redesign. Merge PR265 and return to main before backing up and migrating the actual local runtime. Completion means this bounded scope, not100% source certification.
