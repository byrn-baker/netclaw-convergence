# Equinix Fabric + Network Edge

One official upstream MCP, two NetClaw skills, one optional Risk specialist.
Inventory and documented Fabric operations are supported through a local policy
boundary. The official server is public preview; live schema discovery is required.

## Install and connect

Select **Equinix Fabric + Network Edge** in `scripts/install.sh` (included in the
Cloud profile), then run `scripts/setup.sh`. Node.js/npm and Python 3 are required.
The registered `equinix-mcp` runs `scripts/equinix-stdio.py`, which launches pinned
`mcp-remote@0.14.3` against https://mcp.equinix.com/fabric over HTTP.

Set `EQUINIX_ENABLED=true`. Connect using the registered MCP client, complete its
browser OAuth flow, and choose fabricViewer for inventory. Installation/configuration
is not authentication. No OAuth token or Equinix password belongs in `.env`.
On headless members, arrange a browser callback on that member host; do not copy a
Border token store. Never treat a browser timeout as an empty Equinix inventory.

The default private cache is under the runtime state directory's `equinix-auth`.
`EQUINIX_AUTH_DIR` can set the base; member identity partitions it automatically.
The bridge receives neither ServiceNow verifier nor other integration credentials.
OAuth files and baseline snapshots remain local with private permissions. Do not
attach that directory to tickets or commit it. Revoke consent in Equinix AI Consent
Management when retiring a client; removing local configuration does not revoke it.

## Enable operations

Set `EQUINIX_ALLOW_WRITES=true`, configure `EQUINIX_SERVICENOW_URL`,
`EQUINIX_SERVICENOW_USERNAME`, `EQUINIX_SERVICENOW_PASSWORD` for a read-only verifier
with access to the required change/incident fields. Re-consent with the narrowest
Operator/Manager level needed. Upstream access and NetClaw approval are independent.

1. Discover schemas and read the affected resource/dependencies. Save the returned
   `_meta.netclaw_baseline.id`; the actual snapshot stays in the private cache.
2. Call `netclaw_prepare_change` with `tool`, exact `arguments`, and `baseline_id`.
3. Have the human review the exact call, before/after, affected CI, blast radius,
   cost commitment, rollback and verification. Place the returned marker in the
   CR `implementation_plan` before approval. Populate `backout_plan`, `test_plan`,
   `risk`, `impact`, and primary `cmdb_ci`. For multiple CIs, the operator must also
   perform the normal full affected-CI incident precheck; the code checks primary CI.
4. Wait for the exact CR to be approved and in Implement. Invoke the same tool and
   arguments with `_netclaw: {change_request: "CHG...", baseline_id: "..."}`.
5. Re-read affected objects and compare the approved target. Poll provisioning
   status with bounded reads. Do not close the CR on failure. Record verification
   in GAIT and the CR through the normal workflow; this bridge never closes tickets.

No self-supplied approval boolean is accepted. Changed arguments/baseline require
a new marker and approval. Baselines expire in one hour and on process restart;
each is consumed before write dispatch. A timeout is ambiguous: inspect before
retrying, especially for a billed create. GAIT failure before dispatch blocks it;
a post-result audit failure is surfaced in `_meta.netclaw_audit_ok` and must be
reconciled before closure. Never claim an unverified operation succeeded.

## Capability boundaries

- Read: provider inventory, routes/protocols, NE devices/ACL associations, pricing,
  service profiles, telemetry and Application Connect visibility.
- Gated: documented create/update/replace/attach and operational actions, including
  provisioning, bandwidth changes, routing policy and telemetry associations.
- Delete: **not exposed by the official MCP**. No synthetic delete API or fallback.
- NE virtual-device/ACL CRUD: **not in the announced visibility surface**.
- `refresh_routes` is gated as an action despite its upstream Viewer label.
- A few documentation rows lack an unambiguous permission level; those aliases
  are not admitted until reviewed. Unknown tools fail closed, including new writes.

No Lab bypass applies: AGENTS.md's exception is exclusively Terminal Intent's
API-created Local/Lab requests. Creates without an MCP rollback require an explicit
human-supported backout plan. Service-token results are sensitive; do not echo them.

## Risk and HUD

The `equinix` profile owns `equinix-fabric-operations`, `equinix-network-edge` and
`equinix-mcp`; it gets only `EQUINIX_` settings plus the existing member base floor.
The standard Risk profile discovery/provisioning flow picks it up after opt-in.
Authenticate each member independently. Existing enforcement and capability routing
remain in charge. HUD catalog/configuration entries explain consent and write gates;
they do not fabricate live status, tool counts or authenticated account data.

## Acceptance / platform limits

Offline contracts are in tests/unit/test_equinix.py. Account-owner acceptance still
must verify OAuth, live tools/list, bounded Fabric/NE reads, refresh/revocation,
member isolation and (only with an approved CR) a reversible update plus read-back.
Do not test paid provisioning just to demonstrate connectivity.

There is no tracked native `setup.exe` project in this repository. The implemented
installer/setup route is the existing Bash workflow, including Windows through WSL.
No Windows executable was built; WSL execution still needs platform verification.

Primary references: [overview](https://docs.equinix.com/equinix-api/mcp-servers/overview/),
[Fabric catalog](https://docs.equinix.com/equinix-api/mcp-servers/fabric-mcp-server/),
[Network Edge catalog](https://docs.equinix.com/equinix-api/mcp-servers/ne-mcp-tools/).
