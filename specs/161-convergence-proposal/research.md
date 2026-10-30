# Research: smallest useful integration

## Inspected sources

Upstream `main` remains `b18d51c091fe4c854f970a9c55c84342eb173018` (1.14.0),
checked on 30 October 2026. The proposal branch contains only specification files.
The Convergence fork baseline is `09748c37876fa8be3e3a654f5d8adc4832eb7520`.

| Existing upstream capability | Evidence | Boundary relevant to this proposal |
|---|---|---|
| Grafana dashboards, Prometheus, Loki and alert queries | [grafana-observability skill](../../workspace/skills/grafana-observability/SKILL.md) | Reuse for arbitrary dashboard/log/metric investigation; no replacement is proposed. |
| Direct PromQL and target health | [prometheus-monitoring skill](../../workspace/skills/prometheus-monitoring/SKILL.md) | Existing six-tool query integration; a new general metric client would duplicate it. |
| Receive/query IPFIX and NetFlow | [ipfix-receiver skill](../../workspace/skills/ipfix-receiver/SKILL.md), especially its limitations | Documents in-memory storage lost on restart. The new connector reads an already retained external archive instead of starting another receiver. |
| Multi-protocol telemetry workflows | [telemetry-ops skill](../../workspace/skills/telemetry-ops/SKILL.md) | Existing syslog/trap/IPFIX/gNMI collection stays separately configured. |
| Bounded local service logs with source/time and missing-data behavior | [ReferenceViews.jsx](../../ui/netclaw-visual/src/dashboard/ReferenceViews.jsx), [observability tests](../../ui/netclaw-visual/src/hud-server/observability.test.js) | Existing logs UI expressly starts no remote collector. Reuse its evidence/empty-state conventions, not its local-file readers. |
| HUD access, installation selection and session ownership | [server.js](../../ui/netclaw-visual/server.js), [local-access.js](../../ui/netclaw-visual/src/security/local-access.js), [bindings.js](../../ui/netclaw-visual/src/hud-server/bindings.js) | Trusted interface/origin is not session authentication. New read routes must also require an owned installation-bound session. |
| Server-side MCP calls | [mcp-call.py](../../scripts/mcp-call.py), RAG call site in [server.js](../../ui/netclaw-visual/server.js) | Existing MCP invocation pattern avoids introducing an unrelated connector protocol. Do not expose arbitrary commands/tools from browser arguments. |

## Evidence in Convergence

The fork's [flows route](https://github.com/byrn-baker/netclaw-convergence/blob/09748c37876fa8be3e3a654f5d8adc4832eb7520/ui/convergence-api/src/routes/flows.js)
exposes authenticated `GET /api/flows` and `GET /api/flows/records`. The
[flowSummary implementation](https://github.com/byrn-baker/netclaw-convergence/blob/09748c37876fa8be3e3a654f5d8adc4832eb7520/ui/convergence-api/src/lib/flowSummary.js)
queries retained VictoriaLogs records filtered by site and configured exporter.
It returns exact receipt-time windows, read time, last-received time, traffic rankings,
sampling and explicit limitations. Evidence is the latest 100 matching records.
It cannot establish complete visibility, connection initiation, an application,
malicious intent or billing-quality totals. The first UI must retain these limits.

The existing [case MCP server](https://github.com/byrn-baker/netclaw-convergence/blob/09748c37876fa8be3e3a654f5d8adc4832eb7520/mcp-servers/convergence-case-mcp/server.py)
contains two flow reads but also case mutation and investigation-related tools.
Importing it wholesale would violate the proposed boundary. Extract/reimplement
only the two read contracts into a new optional component. The service's
[auth middleware](https://github.com/byrn-baker/netclaw-convergence/blob/09748c37876fa8be3e3a654f5d8adc4832eb7520/ui/convergence-api/src/middleware/auth.js)
supports scoped API keys; select a viewer key for one site, never the trial's admin
key. The connector must enforce fixed-site requests and response validation too.

## Recommended architecture and maintenance

The current compatible API source is still located in the NetClaw fork at
`ui/convergence-api`; the original standalone `byrn-baker/Convergence` repository
is not a substitute API distribution. “Separately deployed” describes the proposed
ownership boundary, not a claim that an independently released API package already
exists. Before the integration can ship, connection guidance must name a public,
reproducible external service build/image and its tested revision, with retained-flow
setup documented by the Convergence project. A maintainer should not need to import
the fork into upstream to supply that service.


Convergence owns its observability services, data retention and case API. NetClaw
owns a small connector, upstream-compatible HUD presentation and connection guidance.
Contributor Brian Baker maintains the initial connector and its compatibility
fixtures. Each supported external revision must have recorded contract and browser
acceptance; a new response shape requires a tested compatibility update rather than
silently trusting the prototype's package version. The current source has no stable
version negotiation contract that this proposal can promise.

Reuse upstream's isolated Python/FastMCP/MCP dependency policy and HTTP client
family; pin exact versions against upstream at implementation time. No Grafana,
Victoria stack, database, collector or new model dependency is added to NetClaw.
The first supported runtime recommendation is standalone MCP and OpenClaw HUD on
Linux x86_64/ARM64. Hermes tool admission remains a separate source-review and
qualification step; a new read-only label alone does not qualify a Hermes tool.

## Alternatives and why this milestone is smaller

- Extend Grafana/Prometheus queries only: already useful, but still requires the
  user/model to reconstruct Convergence's archive scope, ranking window and limits.
- Deploy the entire Convergence stack in upstream: creates retention, migration,
  chart, database and operational ownership before proving integration value.
- Ship only a link to Grafana: lowest burden, but does not provide same-window
  observation/evidence inspection inside NetClaw; this remains a reasonable
  maintainer alternative if the focused view is still outside desired scope.
- Import the fork's case MCP/HUD: imports mutation, investigation and UI architecture
  beyond the read-only workflow. A fresh small adapter is the recommended boundary.

## Provenance

Brian Baker identified [byrn-baker/Convergence](https://github.com/byrn-baker/Convergence/tree/fff81b52fdd9b792e375208abfa8d091adf9949a)
as the original standalone observability project. Its tree, README and
[MIT license](https://github.com/byrn-baker/Convergence/blob/fff81b52fdd9b792e375208abfa8d091adf9949a/LICENSE)
were reviewed; retain `Copyright (c) 2026 Convergence Project` for derived assets.
That tree contains no copy of the NetClaw API. The API separately declares MIT,
credits Brian Baker and identifies `network-guardian-web` as its predecessor;
the author confirmed ownership. Audit the specific source used for the connector;
do not conflate those histories or relicense surrounding Apache-2.0 NetClaw code.
