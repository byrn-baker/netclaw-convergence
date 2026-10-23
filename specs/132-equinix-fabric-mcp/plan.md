# Plan

Use one official hosted MCP through pinned mcp-remote 0.14.3 and a stdlib JSON-RPC
policy process. Reviewed read/write names only, schemas preserved with a local
_netclaw gate object added to writes. A successful read mints a session baseline ID.
netclaw_prepare_change binds an operation, arguments and baseline to a SHA-256 digest.
The human puts NETCLAW-EQUINIX-SHA256=<digest> in the CR implementation plan before
approval. Re-query ServiceNow for each execution; require exact approved Implement CR,
CI, rollback/verification/risk/impact fields, no open P1/P2 incidents on that CI and
GAIT pre-execution success. This is an external approval boundary, not an agent-supplied
approved=true flag. No lab exemption. Deny unknown/delete tools and server requests.

OAuth uses an isolated private runtime/member cache. EQUINIX_ENABLED opts in;
EQUINIX_ALLOW_WRITES controls write exposure, independently of OAuth consent.
Two skills cover inventory and gated operations. Wire shared installer/setup,
iN2N specialist, HUD catalog/configuration, generated references and inventory counts.
Test gates with synthetic records and a fake upstream process; no cloud writes.

Live account-owner acceptance remains required. No native setup.exe source/build
recipe exists; shared WSL installer is the implemented path. Do not claim a binary.
