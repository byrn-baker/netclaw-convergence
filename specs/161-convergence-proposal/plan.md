# Plan: optional read-only flow-evidence integration

**Status:** Scope proposal only; no implementation in this PR. Implementation
begins after maintainer agreement on this bounded milestone.

## One workflow and one access path

```text
Owned NetClaw HUD session
  → fixed read-only HUD routes
    → two allowlisted MCP tools
      → operator-configured Convergence API (fixed site, viewer credential)
        → existing retained flow archive
```

Proposed MCP tools map to existing service routes:

| Proposed tool | Existing HTTP route | Allowed inputs |
|---|---|---|
| `convergence_flow_summary` | `GET /api/flows` | `range` in 15m/1h/6h/24h, optional configured exporter; site injected server-side |
| `convergence_flow_evidence` | `GET /api/flows/records` | IP address, explicit start/end ≤24h, optional configured exporter; site injected server-side |

Reuse the returned summary start/end when opening records. Summary `status`,
`site`, `read_at`, `total.last_received`, `exporters`, ranking arrays, `basis` and
`limitations` inform presentation. Evidence supplies site/address/start/end/limit,
records and basis. Validate required shapes and bounds before rendering. A 100-record
subset does not explain the entire aggregate; display that limitation.

Proposed HUD routes `/api/hud/convergence/flows` and
`/api/hud/convergence/flows/records` are **new paths**, not existing upstream APIs.
They accept only the same bounded filters, require trusted-origin access plus an
owned installation-bound session, and call fixed MCP tools through the existing
server-side MCP invocation pattern. No general URL/query/command proxy is added.

## Concrete change inventory for the later implementation PR

All paths marked **new** are proposals; no such code is added by this spec PR.

| Surface | Expected files and responsibility |
|---|---|
| Connector — **new** | `mcp-servers/convergence-read-mcp/{server.py,client.py,requirements.txt,README.md}`: two read tools, typed/bounded response adaptation, private fixed configuration and license notice if derived source is copied |
| HUD adapter — **new** | `ui/netclaw-visual/src/hud-server/convergence.js` and `convergence.test.js`: session-gated fixed MCP calls, configuration/unavailable/error mapping |
| HUD view — **new** | `ui/netclaw-visual/src/dashboard/Convergence.jsx` and its tests: rankings, explicit timestamps/limits and evidence detail |
| Existing HUD seams | `ui/netclaw-visual/server.js`, `src/dashboard/Dashboard.jsx`, `src/dashboard/model.js`: mount the route and optional view through current navigation/access conventions; no fork module loader |
| Operator skill — **new** | `workspace/skills/convergence-observations/SKILL.md`: read-only workflow, evidence interpretation and pointer to connection guide; no service deployment commands |
| Connection guide — **new** | `docs/CONVERGENCE.md`: endpoint/site/viewer-key setup, compatibility matrix, smoke checks, disabling, external deployment references and limitations |
| Registration/installation | `config/openclaw.json`, `scripts/lib/catalog.sh`, `scripts/lib/install-steps.sh`, `.env.example`, generated `config/components/catalog.json`: one optional isolated component; names/values reconciled with current upstream conventions |
| Coherence and tests | `README.md`, `SOUL.md`, `TOOLS.md`, `mcp-servers/README.md`; **new** `tests/convergence-read/` and a `tests/contract-suites.json` entry; current release metadata once the implementation spec completes |

Runtime dependencies: upstream-qualified Python, FastMCP/MCP and HTTP client in
an isolated environment, with exact pins established against then-current upstream.
Use existing React/Express and MCP helper infrastructure for HUD wiring. No new
service, storage engine, collector, frontend library or model provider is required.

## Implementation sequence after scope agreement

1. Coordinate the implementation spec and exact connector response/error contract;
   pin the external Convergence revision used by tests, document a public reproducible
   service build/image and retained-flow setup, and verify notices. The original
   standalone repository does not currently contain this API; see research.md.
2. Implement two tools and connection/install coherence. Prove only allowed GET
   paths occur and that endpoint/site/credential cannot be overridden by tool input.
3. Add the optional upstream HUD adapter and evidence view using the same tools.
4. Qualify clean install, enable/disable, upgrade and browser evidence with a
   disposable external service. Publish only the supported runtime/platform matrix.

## Required acceptance evidence

- Deterministic fixtures: valid summary/records, same-window navigation, empty versus
  unavailable, old `last_received`, wrong-site response, malformed/oversized data,
  timeout, redirects and unsupported response contract.
- Access tests: absent/expired HUD session, wrong installation, cross-origin/Host
  rejection, wrong viewer token/site and attempts to supply another endpoint/path.
  Inspect browser/network/log artifacts for credential leakage.
- Side-effect audit: requests are only the two allowlisted GET routes; no case,
  investigation, notification, collection configuration or model invocation occurs.
- Real integration: a disposable Convergence service with synthetic retained flow
  records → MCP → upstream HUD → selected evidence. Record source revision, receipt
  window, expected addresses/bytes, limits and actual screenshot/browser results.
- Lifecycle: fresh optional installation, repeat configuration, source upgrade and
  disable leave external data/services and unrelated runtime settings unchanged.
- Initial matrix: Linux x86_64/ARM64 MCP and OpenClaw HUD. macOS/WSL2/Hermes remain
  unqualified until actual execution; broader fork Docker/K3s passes do not fill
  these integration-specific gaps.

## Release and operational boundary

No version bump for this scope-only proposal. After an agreed implementation passes,
coordinate its minor source release against current upstream. Convergence deploys
and upgrades independently; NetClaw performs no service/database migration. Rollback
of this connector changes only its own installation/configuration and optional view.

## Evidence interpretation clarified during review

The existing records endpoint matches the selected address as source OR destination.
Label direction per record; never equate its latest-100 result with a directional
ranking total. Include a fixture where both directions occur and the bounded subset
cannot reproduce that total. Stale means failed-refresh cached data; display receipt
age independently and make no collector-health inference from quiet traffic.
