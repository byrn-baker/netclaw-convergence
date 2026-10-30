# Research and decisions — 2026-10-30

## Upstream and qualification

Decision: pin automateyournetwork/pyATS_MCP at
`4a3c1e3404d5ed7a78cb094bf26d2a49065497d9` (October 28). Keep the
isolated Python 3.12 runtime and MCP 2.3.0; retain generation promotion/rollback.
The actual process exposes 34 tools, eight named `pyats_testbed_*`. Research
used a fresh `/tmp/netclaw-spec160-native-tests-20261030` runtime, not an owner
installation. Its 196 upstream tests pass; an official MCP client also exercised
real schema loading, build, activation, inventory listing and restart without
TCP probes or device login. Upstream tests alone mock device/schema behavior.

Primary sources:
- https://github.com/automateyournetwork/pyATS_MCP/commit/4a3c1e3404d5ed7a78cb094bf26d2a49065497d9
- https://github.com/automateyournetwork/pyATS_MCP/blob/4a3c1e3404d5ed7a78cb094bf26d2a49065497d9/docs/dynamic-testbeds.md
- https://github.com/automateyournetwork/pyATS_MCP/blob/4a3c1e3404d5ed7a78cb094bf26d2a49065497d9/pyats_testbed_builder.py

## Managed composition boundary

Decision: compose existing source MCP output (or explicitly imported structured
exports) into a strictly validated, provenance-bearing envelope, then invoke the
actual upstream inline builder with a fixed mapping and environment credential
references. Upstream natively fetches Itential, NetBox, Nautobot and Catalyst Center;
that capability is distinguished from NetClaw's managed composition route.
The managed tools do not expose unsafe raw file/REST fetch or static credential
copy/merge. Generic REST means an explicitly authorized source reader/export,
not an arbitrary URL executor in pyATS. All sources share the same review checks.

Rationale: upstream raw fetch follows redirects/proxy environment, only compares
hostnames on some pages, silently truncates at limits and can return partial
pagination. `headers_env` can select arbitrary process secrets. Static credential
copy/merge and arbitrary field mappings can expose secrets through previews.
Normalizing existing integrations avoids a second set of vendor HTTP clients.
No source discovery grants authority to log in or configure devices.

Alternatives rejected: directly expose every upstream fetch variant (unbounded
or insufficiently isolated); duplicate twelve vendor clients (drift and privilege
expansion); infer management SSH from lab console ports (wrong endpoint identity).

## Lifecycle and concurrency

Decision: an owned launcher imports the pinned upstream without editing its source,
uses its official MCP server/tool registration, and guards dynamic operations.
A new `netclaw_testbed_compose` tool normalizes source records before calling the
upstream builder. Candidates are immutable, uniquely named, and must pass actual
schema/credential validation before explicit activation. Active deletion and
replacement are refused. In-flight device work prevents activation; shared state
operations are serialized. Dynamic mode unsets `PYATS_TESTBED_PATH` as well as
setting `PYATS_MCP_DYNAMIC_ONLY=1`, preventing silent static fallback.

Rationale: registry is process memory, unrelated to HTTP session state. A real
process confirmed upstream allows replacing an active name with `activate=False`
and activating an invalid candidate. Upstream defaults to static after restart
or active deletion. Each NetClaw one-shot MCP call creates a fresh process.

Decision: provide a bounded official-MCP CLI session that composes, validates,
optionally explicitly activates, and lists inventory in one process. Native clients
retain their session process. No daemon, persistent registry, silent source refresh
or replay of device actions. Candidate files are private reviewed input, not active
state. Restart means rebuild/revalidate/reactivate. Tasks receipts are not validation
success; only the actual completed validation result qualifies.

## Installation and UI

Decision: additive optional `claw.testbed` policy in existing schema-1 plans;
absent means static compatibility. Canonical source descriptors drive source
selection, prerequisites and help. Static inputs keep their existing hashed file
contract. Dynamic setup creates no dummy YAML and never contacts inventory sources
or devices. Private per-installation env stores mode/source identifiers and credential
references; passwords stay in the existing secret phase. Both schema-plan terminal
setup and legacy `scripts/setup.sh` offer the choice, as does VS Code.

Rationale: currently Deployment.inputs manufactures an empty YAML, generated settings
force a static path, and setup.sh edits checkout inventory. Those assumptions must
be removed only for explicit dynamic selection. Existing operator data remains owned
by the operator. HUD static editor/collector bindings remain separate and clearly
labeled: activating an MCP testbed cannot grant collector or Terminal Intent access.

## Source contracts

The companion source matrix records exact observed tools and primary documentation.
All twelve sources have an executable mapping fixture; that is not live qualification.
GNS3/EVE-NG console-only records need independently observed management data.
CML tool names and schemas differ by version; capability-probe the installed MCP.
ServiceNow's installed MCP lacks a verified CMDB reader, so use an authorized Table
API export until a suitable read tool is proven. Infrahub schema is user-defined.
IP Fabric SDK8 uses loginIpv4/loginIpv6, not the historical loginIp field. Nautobot
MCP and native REST response shapes differ. Never claim an unverified source tool.

## Remaining qualification boundaries

No unresolved design decisions. Live provider credentials, lab/device access,
Windows/WSL host acceptance and owner-runtime upgrades are separate qualification
rows, not invented prerequisites satisfied by fixtures. No release/publish action
is part of this source feature implementation.

## Final desktop qualification

Native selection/save/cancel/reload/static readback passed in an isolated official
VS Code 1.145.0 Insiders host with a separate application identity. Older stable
1.109 showed a blank webview and stable 1.144 could not be driven reliably by the
computer-use surface; no root cause or stable-editor visual pass is claimed.
See verification.md for the exact bounded native acceptance and artifact readback.
