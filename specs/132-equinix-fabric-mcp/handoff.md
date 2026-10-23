# Resume here — spec 132

Request: new Equinix MCP SDD feature, skills, wiring, Risk membership, installer,
HUD and blog handoff. User has limited weekly budget; preserve checkpoints.
Branch: 132-equinix-fabric-mcp (Git and GAIT). No push requested.

## Milestone 1 — research/spec complete

Read spec.md, research.md, plan.md, tasks.md before continuing. Core decision:
ONE upstream Fabric MCP includes NE. Two skills; read-only exact policy boundary;
browser OAuth, not customer API client credentials. No setup.exe source exists.
GAIT local runner works. pyATS cannot initialize without PYATS_TESTBED_PATH.
MemPalace tools unavailable. Never turn missing live evidence into success.

Next: implement scripts/equinix-stdio.py and offline policy tests, then wire all
surfaces in docs/ADDING-AN-MCP.md plus scripts/in2n-profiles.py and HUD maps.
Do not run live cloud calls or create ServiceNow tickets to test source changes.

## Scope correction — owner steering

The owner explicitly requested gated CREATE/UPDATE/DELETE wherever supported.
Supersedes the read-only-only design above. Official MCP has NO DELETE. Implement
all documented other mutations with external ServiceNow approval bound to an exact
operation digest, real baseline, incident precheck and fail-closed GAIT. Do not
apply Terminal Intent Local/Lab exception to hosted Equinix.

## Milestone 2 — policy and skills implemented

`scripts/equinix-stdio.py` fronts pinned mcp-remote; `scripts/lib/equinix/policy.py`
owns reviewed names and the ServiceNow verifier. Two skills added. Writes augment
live schemas with `_netclaw`; netclaw_prepare_change binds the exact operation and
baseline to a CR marker. Baseline consumption prevents same-session replay. No delete.
Private baseline snapshots and OAuth cache are runtime-only. Verify tests next.

## Milestone 3 — integration wiring implemented

Config equinix-mcp; installer equinix component + cloud profile; setup opt-in and
ServiceNow verifier; iN2N Equinix profile/env slice/server scope; HUD catalog/config
entries. Still need offline tests, inventory reconciliation, generated docs, blog
and release notes. No runtime deployment or browser consent has happened.

## Milestone 4 — offline verification complete

26 tests pass in evidence/tests.txt (16 Equinix policy/transport/federation cases,
plus installer/setup regressions). Evidence also records catalog/docs/portability/
packages/dependencies reconciliation, targeted startup, SDD and successful HUD build.
Python compilation, Bash syntax, JS syntax, release check and git diff --check pass.
HUD initially lacked @xterm/xterm; `npm install --ignore-scripts --no-audit --no-fund`
restored declared dependencies with no package-lock change. Existing chunk warning
remains. No broad fleet startup, live cloud calls or paid provisioning were run.

## Milestone 5 — delivery and next-model resume

Final branch/spec: **132-equinix-fabric-mcp**. Initially chose 131, but release
validation found tracked 131-canvas-terminal-workflows. Renamed feature and Git/GAIT
branches; existing Canvas spec untouched. Record this mistake: check ALL spec
number prefixes before reserving a number, not just a filtered listing.

Source release metadata prepared as 1.2.0, not tagged/published. Inventory: 235 skills,
174 integrations. Operator guide docs/EQUINIX.md; blog draft and editorial handoff
under docs/blog/2026-09-29-equinix-*.md. No publication authorized.
Generated references include this feature only; generator also found unrelated
stale entries, deliberately not bundled into this change.

### Resume prompt for Sonnet-5 or another model

Read this file, spec.md, docs/EQUINIX.md and contracts/mcp.md. Source implementation
and offline tests are complete. Do not rebuild the integration or repeat paid calls.
Remaining acceptance: operator browser OAuth on standalone and isolated Risk member;
live manifest/schema/pagination verification; read-only Fabric and NE examples;
expired/revoked consent handling; approved reversible update/read-back if explicitly
requested; WSL installer test. The checkout contains no native setup.exe packaging
source, so no binary exists. Do not call this fully production-verified yet.

The upstream MCP has no DELETE and no NE-device CRUD. Unknown/new tool names are
blocked. Do not add an arbitrary REST fallback to claim full CRUD. Risk/member
credential partitioning depends on the runtime supplying N2N_MEMBER_ID; verify this
in live member acceptance. Token caches are never copied from Border.

Operational limitations: baseline lifespan is one process/hour; fresh baselines
change the approval digest. Code checks primary-CI P1/P2 incidents; skill/operator
must check the full affected-CI set. Post-execution verification is a mandatory skill
workflow, not an automatic compare engine; the bridge never closes CRs. ServiceNow
ACLs must expose all required verifier fields. GAIT availability is required for
writes, and no Terminal Intent Local/Lab bypass exists for this integration.

No live network discovery: pyATS startup failed without PYATS_TESTBED_PATH. MemPalace
not exposed by current tools. No tickets created. Daily file records session locally.

### Audit correction

Final gait_log exposed a runtime detail: gait_branch creates without switching.
The initial session entries (190f0156, 9d5d75bb, 131fcd28) landed on the previously
active GAIT branch. They remain immutable. Explicit gait_checkout to
132-equinix-fabric-mcp followed by a correction record links all three and the source
commit 7b8a041. Future sessions must call gait_checkout after gait_branch.
