# Spec 132 — Equinix Fabric and Network Edge

Branch: `132-equinix-fabric-mcp` · Created: 2026-09-29 · Status: source implemented; live account acceptance pending

## User scenarios

1. P1: An operator inventories Fabric connections and Network Edge devices and ACLs,
   with account/project/metro, observation time and pagination explicitly reported.
   Acceptance: available read schemas are discovered; denied/expired/empty results differ.
2. P1: A Risk of Claws routes provider questions to an Equinix specialist, correlating
   evidence with device, cloud and source-of-truth members without sharing credentials.
   Acceptance: profile selects only Equinix specialty skills/MCP and scoped environment.
3. P2: Installer/setup and HUD expose the integration and explain browser consent.
   Acceptance: selected cloud component is installable; no configured-equals-live claim.
4. P2: A successor can resume every milestone and a writer can build a cited blog.
   Acceptance: handoff includes exact files, checks, remaining live work and demo limits.

## Requirements

- FR-001: One official upstream endpoint, https://mcp.equinix.com/fabric, for both
  product families. No invented Network Edge endpoint or extra server count.
- FR-002: Browser OAuth with fabricViewer; no API-key/password setup prompts.
- FR-003: Exact tool catalog separates reads and writes; writes require explicit
  EQUINIX_ALLOW_WRITES opt-in, observed baseline and a freshly verified ServiceNow
  approved/Implement CR bound to the exact operation digest. No unknown tools.
- FR-004: Preserve discovered schemas, upstream errors and pagination cursors.
- FR-005: OAuth cache isolated per runtime/member, private directory; no tokens in
  .env, GAIT, HUD, research or shared workspace. Explicit opt-in before connection.
- FR-006: Add two skills, cloud installer/setup entries, scoped iN2N membership,
  HUD catalog/configuration descriptions and generated reference documentation.
- FR-007: Compare evidence by UUID and scope, not display name; distinguish provider
  control-plane inventory from forwarding truth, simulation and intended state.
- FR-008: New tool names remain denied pending review; never guess schemas in preview.
- FR-009: Support documented create/update/replace/attach/actions through the gate,
  including billable operations. CR implementation plan must bind the exact digest;
  risk, impact, rollback and verification plans must exist. P1/P2 incidents on the
  affected CI block execution. GAIT failure blocks writes. No automatic retry.
- FR-010: Delete is unsupported by the official MCP and must be refused, not routed
  through an invented API. No lab bypass: Terminal Intent Local/Lab is a separate flow.
- FR-011: Write results are execution evidence only. Re-read affected resources and
  compare the approved target state before recommending CR closure. Never auto-close.

## Success criteria

Offline policy and federation tests, shell/Python/JS checks and reconciliation pass.
Live acceptance explicitly pending until account owner completes OAuth and verifies
Fabric + NE reads. No production changes or external tickets/publication in this task.
`setup.exe` has no source/build target in this repository: cover scripts/install.sh,
scripts/setup.sh and their shared catalog; document Windows/WSL packaging limitation.
