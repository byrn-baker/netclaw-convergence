# Feature Specification: Dynamic pyATS testbeds across NetClaw sources

**Feature Branch**: `160-dynamic-pyats-testbeds`

**Created**: 2026-10-30

**Status**: Authorized for research, implementation and feasible verification by the owner

**Input**: Adopt latest upstream pyATS MCP dynamic testbeds; compose existing lab,
CMDB, source-of-truth and assurance sources; expose static/dynamic and source
selection in VS Code and setup.sh installers; update documentation and test to
completion without inventing live qualification.

## User Scenarios & Testing

### User Story 1 — Choose testbed mode during setup (Priority: P1)

An operator can retain a static testbed or choose dynamic inventory and one or
more sources in either the VS Code installer or terminal setup. Choices are
installation-specific, survive pause/resume, and are visible in plan review and
readiness reports. Existing static installations retain their behavior.

**Independent test**: Complete both setup paths with private temporary homes;
read back each mode/source choice and verify cancellation and static preservation.

**Acceptance scenarios**:
1. Given a new claw, choosing static retains the explicit testbed path; choosing
   dynamic does not require a fabricated static YAML or contact a device.
2. Given dynamic sources, the installer names prerequisites, source ownership and
   supported composition routes, without storing secret values in plans/UI state.
3. Given an existing operator testbed or credentials, setup preserves them unless
   an exact reviewed change was requested. Source service credentials stay distinct
   from device login credentials.

### User Story 2 — Build a scoped testbed from existing sources (Priority: P1)

An operator can discover inventory using existing NetClaw integrations and create
an on-demand testbed using upstream pyATS MCP tools. Supported source choices
cover Itential, CML, containerlab, EVE-NG, GNS3, ServiceNow, Catalyst Center, NetBox,
Nautobot, OpsMill Infrahub, IP Fabric and Forward Networks, plus structured local
inventory and explicitly permitted REST sources.

**Independent test**: Every named source has a researched, executable composition
contract and representative fixture; normalized records reach the actual upstream
builder. Direct upstream sources are distinguished from MCP-composed sources.

**Acceptance scenarios**:
1. Scope inventory by source-specific lab/project/site/query/snapshot identity;
   preserve source freshness/provenance and expose omissions or incomplete pages.
2. Map only observed management addresses, ports and supported OS values; lab
   console endpoints never silently become device SSH endpoints.
3. Reject conflicting identities, malformed addresses, unresolved platform
   mappings and missing credential references before activation. Empty or stale
   inventory never proves no devices exist or that a device is healthy.

### User Story 3 — Review, validate and activate safely (Priority: P1)

The operator sees a redacted preview, validates the candidate without device
connections by default, and explicitly activates the selected testbed. Existing
pyATS tools then use it. Source fetching, topology validation, optional reachability,
login and device state are separate evidence stages.

**Independent test**: Against a private actual upstream MCP process, build a
synthetic candidate, validate, activate and list devices without contacting them;
exercise restart and one-shot CLI behavior and preserve the operator’s static file
for an explicit return to static mode. Dynamic mode never falls back automatically.

**Acceptance scenarios**:
1. Preview does not activate; failed fetch/mapping/validation preserves the active
   testbed and gives actionable evidence. No configuration write is authorized.
2. Runtime and client restarts report loss/rebuild requirements truthfully; tool
   calls never silently fall back to a different inventory.
3. Persistent clients and one-shot skill calls have a documented working path
   to apply a candidate and use it in the intended installation.

### User Story 4 — Maintain the integration (Priority: P2)

Maintainers can install the reviewed upstream revision reproducibly, understand
source composition and security boundaries, and run offline and actual-tool
acceptance. README, setup guidance and skills describe the same capabilities.

**Independent test**: Install the pinned source in an isolated runtime, inspect
actual tool schemas and run regression/installer checks and both UI entry points.

### Edge Cases

Missing providers or credentials; stale snapshots; pagination and partial results;
duplicate names/addresses across sources; OS ambiguity; IP prefixes/IPv6/hostnames;
lab consoles vs management SSH; unsafe file paths/REST hosts/redirects; secrets in
inventory; runtime/client identity changes; concurrent activation; expired sessions;
paused setup; unsupported platforms; absent static file; old installed upstream.

## Requirements

### Functional Requirements

- **FR-001**: Pin and verify the latest researched upstream dynamic-testbed revision
  while retaining NetClaw's isolated runtime, local transport and rollback behavior.
- **FR-002**: Both VS Code and terminal setup MUST offer static or dynamic mode and
  explicit dynamic source selection, persisted in the reviewed selected-claw plan.
- **FR-003**: Static remains backward compatible; dynamic-only setup requires no
  dummy static testbed and MUST NOT overwrite operator inventory or credentials.
- **FR-004**: Provide accurate, source-specific composition contracts for all twelve
  named sources plus structured/REST inputs, distinguishing native vs composed paths.
- **FR-005**: Scope selections, mapping, provenance, freshness and incomplete
  pagination are explicit; conflicting devices or missing connection facts block
  activation instead of guessed platform/address/credential values.
- **FR-006**: Use upstream MCP testbed tools for preview/build/validate/activation;
  preserve a clear active-testbed identity and a working persistent/one-shot path.
- **FR-007**: Secrets remain in private installation environment storage; device
  credentials use references. Plans, previews, reports and logs exclude secret values.
- **FR-008**: File/REST boundaries, least privilege, source ownership, read-only
  discovery and existing change-control/collector protections remain enforced.
- **FR-009**: Fetching inventory or activating a testbed MUST NOT imply device
  reachability, login, health or permission to configure. Active devices change only
  through explicit reviewed selection; no automatic device operation.
- **FR-010**: Installation readiness distinguishes runtime tools, selected source
  configuration, built candidate, activation and independently verified execution.
- **FR-011**: README, installer docs, reference/skills/catalog and tests MUST agree
  with actual tools, mode behavior and source coverage, including restart limitations.
- **FR-012**: Record actual offline, native-process, installer/UI and available live
  acceptance separately; never mark unavailable live services as tested or fabricate
  device evidence to achieve a percentage.

### Key Entities

- **Testbed policy**: installation, mode, explicit static path, selected sources and
  non-secret configuration references.
- **Source selection**: source kind, owner/profile, inventory scope, mapping and
  freshness/collection evidence; source login distinct from device credentials.
- **Candidate testbed**: normalized device identities/endpoints/OS/credential
  references, source provenance, omissions/conflicts, validation and review status.
- **Active binding**: exact installation/runtime/client, candidate identity and
  lifetime; previous testbed or explicit unresolved state after restart/failure.
- **Qualification evidence**: stage, source/runtime version, observed result and
  limits; fixture data distinguished from real network/device evidence.

## Success Criteria

- **SC-001**: Both installers complete static and dynamic flows and preserve operator
  data across cancel/resume; all mode/source choices read back consistently.
- **SC-002**: All twelve named sources plus structured/REST inputs have researched
  contracts, visible selection and passing representative composition tests.
- **SC-003**: Actual upstream tools build, validate, activate and expose a synthetic
  inventory, and demonstrate documented restart/one-shot behavior without device I/O.
- **SC-004**: Adversarial cases for secrets, scope, unsafe destinations, conflicts,
  partial inventory and old runtime fail safely while preserving the prior state.
- **SC-005**: All implementation tasks and mandatory feasible checks pass; an
  explicit qualification matrix separately lists any live/platform prerequisites.

## Assumptions

- “snow” means ServiceNow CMDB; “cat center” means Cisco Catalyst Center; “gns”
  means GNS3; “opsmill” means OpsMill Infrahub. Itential is included because it is
  the new upstream default source.
- Existing MCP integrations are composed where suitable rather than duplicating
  every vendor client. Source selection is opt-in; static is the compatibility
  default for existing installations.
- Research, source changes, isolated installations/tests and local commits are
  authorized. Existing owner-runtime upgrades, network changes, provider spending
  and release/Marketplace publication are separate from this feature request.
- “100%” means complete implementation and truthful feasible verification, not
  blanket live certification of services or credentials unavailable in this session.
