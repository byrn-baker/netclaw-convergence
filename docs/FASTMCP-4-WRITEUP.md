# NetClaw 1.5.0: FastMCP migration writeup

## Outcome and scope

Spec 141 introduces FastMCP 4.0.11 and MCP Python SDK 2.3.0 across all 35 repository-owned FastMCP servers and compatible external integrations. This release ships that verified scope. It does not close the original fleet-wide objective: five external integrations still need native ports or replacement decisions, and RADKit requires a licensed dependency before acceptance.

The source version moves from 1.4.0 to 1.5.0 because modern protocol negotiation and stateless HTTP are substantial new runtime capabilities. HUD and mobile versions retain their independent lifecycles. The owner authorized the branch, release writeup, push, PR, merge, branch deletion and source publication. Publishing source does not deploy running services.

## Spec-driven process

The [specification](../specs/141-fastmcp-stateless-upgrade/spec.md), [research](../specs/141-fastmcp-stateless-upgrade/research.md), [plan](../specs/141-fastmcp-stateless-upgrade/plan.md) and [tasks](../specs/141-fastmcp-stateless-upgrade/tasks.md) define the migration and its acceptance criteria. An inventory and baseline catalogs were collected before implementation. Final dispositions distinguish migrated, excluded, retired and blocked integrations. The open external-port task remains open rather than being relabeled complete for release.

## Implementation

Owned servers import standalone FastMCP and use exact framework pins. Per-component constraints keep modern environments separate from legacy low-level SDK consumers. Dot and reviewed UML use explicit stateless HTTP. Public framework APIs replace removed context, lifespan, registration and constructor behavior where required. Application state, authentication, read-only filters and change-control rules remain authoritative.

External integrations use checked-in revision and hash metadata with reviewed patches. Fresh clones select the reviewed revision; existing source is checked before edits. Unknown content is rejected, repeat application is supported, and a write failure restores files changed by that invocation. The installer does not overwrite operational clones with an unchecked pull. This protection is not a transaction across installation, concurrent source edits or vendor operations.

GAIT builds a candidate interpreter with matching bundled source and validates discovery before promotion. Restore selects the matching retained generation. Fixes also address Azure subscription package separation, external dependency conflicts, SDK exception construction, HTTP launch configuration and diagnostic output.

The migration intentionally does not enable automatic retries, caching or code execution across all tools. Those features would alter side effects or persistence and require separate specifications. Sessionless MCP transport alone does not make local databases, files or application sessions distributable.

## Test evidence and its limits

| Area | Recorded result |
| --- | --- |
| Owned catalog discovery | 35/35 pass in legacy and modern protocol modes; 450 tools. |
| Owned dependency resolution | 35/35 resolve for Python 3.12. |
| Baseline comparison | 29 available baselines preserve names and required arguments; six baseline imports lacked dependencies. Claroty's corrected unrestricted JSON schema is reviewed explicitly. |
| External discovery | 33 pass, 767 tools including seven in a retired reference; RADKit fails on its missing licensed client. |
| External source resolution | 26 active source components pass; RADKit blocked; two retired entries excluded. |
| Regression coverage | Auvik 387, Halo 135, N2N 554, memory 62, RAG unit 73, RAG integration 18, Jevons 82, protocol/GNS3/Zoom 71, framework/installer/GAIT 43 and Itential OAuth/serialization 41 pass in the recorded runs. |
| Runtime recovery | Isolated real GAIT candidate build, legacy wrapper call, rebuild and restore pass. |
| Repository contracts | Pin checks, SDD artifacts, contract inventory, registration/dependency/documentation/package/portability reconciliation and relevant shell suites pass. |

The [verification report](../specs/141-fastmcp-stateless-upgrade/verification.md) and adjacent JSON artifacts are the detailed evidence. Counts describe separate selections and must not be summed into a unique total. Local execution used macOS Python 3.13; dependency resolution separately targeted 3.12. Remote Linux CI adds repository contract coverage at release time. Its first run exposed stale Dot dependencies, Zabbix framework assertions/client imports and an installer test runtime path. These harnesses were updated to the current framework and recorded runtime, including real discovery in both protocol modes; the failed run remains visible in the PR.

Catalog probes use fixture credentials and block outbound connections. They do not prove live vendor authorization or successful tool execution. CML's eager vendor constructor is stubbed for discovery. Full HTTP authorization matrices and all supported Python/OS combinations remain untested. Device inventory could not run because PYATS_TESTBED_PATH was absent; no device state was inferred.

RAG verification initially wrote fixture audit events into the session GAIT branch. Temporary audit repositories now isolate those fixtures; re-runs passed and left the operational audit head unchanged. The original immutable events and an explicit correction remain in the audit trail.

## Remaining work

| Integration | Release disposition |
| --- | --- |
| Atlassian | Existing runtime retained; requires a native port preserving private dispatch filters and per-user session authentication. |
| AWS Cost Explorer | Existing runtime retained; source-distribution port or explicit replacement required after upstream source removal. |
| AWS Diagram | Existing runtime retained; source-distribution port or explicit replacement required. |
| PagerDuty | Existing local runtime retained; archived upstream requires a maintained fork or deliberate hosted OAuth migration. |
| Blender | Existing runtime retained; SDK1 Apps, sockets, addon negotiation and telemetry require a tested native port. |
| RADKit | Modern patch prepared, but licensed cisco-radkit-client is unavailable for validation. |

Low-level SDK, custom-protocol, remote, Go and Node servers are outside this FastMCP source migration. Retired clones are not counted as active fleet success.

## Adoption and rollback

Follow the [upgrade guide](FASTMCP-UPGRADE.md). Retain source, runtimes and configuration before installation, validate in a separate release checkout, perform authorized read-only vendor checks, then switch managed launch paths. Restore matching source and interpreter on failure. General pip upgrades are not transactional. Application data and GAIT history must be preserved.

[Release notes](releases/1.5.0.md) accompany the PR and GitHub source release. The PR and exact-commit workflow records provide remote CI results; publication must wait for applicable checks without bypassing failures.

## Coordinated Tasks extension (spec 142)

The owner extended this unpublished release to include Tasks. [Spec 142](../specs/142-mcp-async-tasks/spec.md) adds 242 task-enabled tools across 30 owned servers, 34 across four external servers, and pins the 22-tool pyATS implementation: 298 tools across 35 integrations. The [operational guide](MCP-TASKS.md) distinguishes ephemeral FastMCP storage from persistent pyATS results. See the [verification](../specs/142-mcp-async-tasks/verification.md) and [social post](social/MCP-TASKS-POST.md).
