# Editorial handoff — Equinix

Draft: 2026-09-29-equinix-composable-operations.md. Technical truth:
../../specs/132-equinix-fabric-mcp/research.md and ../EQUINIX.md.

Audience: network/cloud engineers who already understand MCP but want to see why
combining provider, device, cloud, intent and change-management tools matters.
Lead with the congested cloud path. Show the whole evidence-to-approval-to-verification
chain; avoid a catalog of tool names or claims that AI replaces engineering judgment.

Suggested demonstration (requires owner account and approved change):
1. Show Equinix in HUD catalog/config and its Risk specialty.
2. Run scoped provider reads and independent device/cloud checks. Capture timestamps,
   IDs, pagination coverage and errors honestly. Redact all account/customer identifiers.
3. Show a blocked unapproved write using an offline fixture, visibly labelled synthetic.
4. Show preparation marker and approval boundary. Only show a real execution if the
   account owner authorizes it through the CR workflow; never stage a paid order.
5. Show read-back and an evidence-sourced report. Mark incomplete layers as unavailable.

Visual ideas: existing HUD integration entry; a diagram of evidence sources feeding
Border; a concise baseline → exact CR → execution → verification sequence. Do not
invent customer topology or screenshot fake live success. No benchmark/savings claims.

Claims to retain: one upstream service, two skills, gated Fabric operations, explicit
unsupported delete/NE CRUD, member-scoped OAuth, no automatic CR closure.
Claims to avoid: complete Equinix API coverage, end-to-end health from inventory,
production certification, live OAuth/write verification completed, shipped setup.exe.

Publication is not authorized. This is a local draft; no WordPress, Slack or email
was sent. Obtain review before publishing and link the primary Equinix sources.
