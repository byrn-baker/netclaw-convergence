# Feature Specification: Read-only Convergence flow evidence in NetClaw

**Feature Branch:** `161-convergence-proposal` · **Created:** 2026-10-30
**Status:** Proposed scope for maintainer review; this PR contains no implementation.

## Recommendation and decision requested

Accept one optional integration: **select a retained traffic observation in NetClaw
and inspect the matching flow records that support it**. Convergence remains a
separately deployed service. NetClaw receives a small read-only MCP connector and
one focused HUD view; it does not acquire an observability platform to operate.

**Maintainer decision:** Does this bounded read-only flow-evidence integration,
with the ownership and acceptance criteria below, belong in NetClaw?

The broader Convergence roadmap is context, not part of this scope request. A later
implementation PR must qualify this integration against upstream; the existing fork
is not proposed for wholesale merge.

## Problem and distinct value

NetClaw already provides Grafana/Loki queries, direct Prometheus queries and live
IPFIX/NetFlow reception. Those remain the preferred interfaces for their purposes.
The proposed addition presents an existing Convergence archive's **site/exporter-
scoped traffic ranking with the same observation window and supporting retained
records**, without asking users to construct a query or run a new collector inside
NetClaw. Upstream's IPFIX receiver documents in-memory storage lost on restart;
Convergence's existing flow API reads retained VictoriaLogs records. See the
[source comparison](research.md) for the actual interfaces and their limits.

Example: select a destination ranked by exported bytes over the last hour, open
its latest flow records involving that address in either direction for the same
window, and see each record’s direction, exporter, receipt times, sampling and
coverage limitations. These address records are context for the observation, not
a directional reconstruction of its ranking total. This is evidence inspection, not a threat
verdict, application identification or automatic investigation.

## Ownership

| Concern | Owner in the proposed first milestone |
|---|---|
| Collection, retention, VictoriaMetrics/Logs, Loki, Grafana, alerting, case API and service credentials | Independently deployed Convergence; configured and operated by its operator |
| Two read-only flow tools, bounded response adaptation and optional HUD view | NetClaw integration |
| Endpoint, fixed site and scoped read credential on the NetClaw host | Operator configuration; private, server-side |
| Deployment, upgrades, backups and migrations of the observability stack | Convergence project; outside this upstream implementation |
| Integration tests, upstream access conventions and connector compatibility documentation | NetClaw contribution, initially maintained by contributor Brian Baker |

Installation guidance connects an existing service and links to its independently
maintained setup instructions. K3s is the Convergence project's persistent path;
Docker is its smaller trial. Neither chart nor container stack is imported here.

## User scenarios and acceptance

### US1 — Inspect an observation and its evidence (P1)

An operator enables the connector for one site, opens the optional Convergence
view, selects a ranking window and destination, then inspects matching records.

1. A summary displays source identity, site, configured exporters, exact start/end,
   read time, last received time, observed bytes/packets and limitations.
2. Selecting an address requests evidence using the summary's fixed start/end and
   exporter selection, not a new rolling window. At most 100 recent records involving
   that address as source OR destination are displayed, with direction relative to
   the selected address labeled. This subset can include reverse-direction traffic;
   it is not presented as reproducing a source/destination ranking or full aggregate.
3. The view distinguishes valid empty results, disabled/unconfigured source,
   unauthorized access and backend unavailability. A failed refresh marks previously
   successful data as stale cached data; it never becomes a fresh zero. Show receipt
   age separately: quiet/old traffic does not by itself establish collector failure
   or degraded capture coverage.

### US2 — Connect without exposing credentials or changing services (P1)

1. Setup adds one optional isolated MCP component and connection settings. It
   preserves existing runtime/model credentials, Grafana ownership and deployments.
2. The endpoint and site are fixed in server configuration. Browser/tool arguments
   cannot select another URL or site, request arbitrary paths or supply raw queries.
3. A viewer credential restricted to the selected site remains on the server and
   absent from browser responses, logs, rendered errors and tracked files. Responses
   with another site are rejected even if the service credential has broader access.
4. Both tools are read-only; no collector configuration, case write, notification,
   firewall action, model call or investigation is available through this component.

### US3 — Upgrade or disable the integration predictably (P1)

1. The connector documents the exact tested, publicly reproducible Convergence source/image revision and
   validates its expected response shape; unsupported/malformed responses are explicit
   compatibility errors. No stable versioned API is assumed from the prototype.
2. NetClaw upgrade preserves private connection settings. Disabling/removing the
   connector stops its requests and removes/marks the optional view unavailable;
   it leaves all Convergence data and services intact.
3. An integration smoke check requires no LLM or production device credentials.
   First qualification targets Linux x86_64/ARM64 with an OpenClaw HUD and standalone
   MCP invocation. macOS/WSL2 and Hermes execution remain explicitly unqualified until
   exercised under upstream's existing runtime/platform rules.

## Functional requirements

- **FR-001:** Expose only proposed `convergence_flow_summary(range, exporter?)` and
  `convergence_flow_evidence(address, start, end, exporter?)` MCP tools. Their names
  are proposed; source HTTP paths already exist and are documented in [plan](plan.md).
- **FR-002:** Allow only 15m/1h/6h/24h summary windows, valid IP evidence addresses,
  ordered ISO timestamps spanning at most 24h, and service-configured exporters.
  Bound remote requests to 20 seconds and decoded responses to 1 MiB; propagate
  truncation/limits and reject invalid or mismatched-site payloads.
- **FR-003:** Use operator-configured HTTPS with certificate verification; permit
  HTTP only for an explicitly configured loopback development/port-forward target.
  Reject URL credentials and redirects; never derive an endpoint from observed text.
- **FR-004:** HUD routes retain trusted-origin/interface checks and require an owned
  installation-bound HUD session. Server-side calls use the same MCP tools, not a
  second unrestricted HTTP proxy. Escape observed strings; preserve provenance.
- **FR-005:** Keep the view optional and default disabled. An unconfigured integration
  must not fail HUD startup, slow unrelated views or change existing tool behavior.
- **FR-006:** Add regression/contract/browser evidence for the scenarios above,
  including wrong site/token, missing session, cross-origin requests, timeout,
  malformed/oversized response, failed-refresh/empty data, evidence-window continuity,
  and mixed-direction records that cannot be equated with directional ranking totals.
- **FR-007:** Include installer/catalog/configuration/skill/HUD documentation and tests
  required by the constitution. Preserve applicable source notices for derived code.

## Success criteria

A fresh upstream checkout can install and configure the optional connector, inspect
one synthetic retained flow observation and its same-window records, then upgrade
and disable it without altering the external stack. Negative access and unavailable-
source cases pass automated tests; real browser interaction proves the stated
behavior. Historical fork installation tests are feasibility evidence only.

## Explicit exclusions

No Convergence API/server import, PostgreSQL schema, Helm chart, storage deployment,
collector, IDS capture, case mutation, autonomous investigation, model/provider
change, notification, shared Grafana adoption, fork module loader, personal profile
or network-device configuration. Existing Grafana/Prometheus/IPFIX integrations
remain independent. Case workflows and other observation types require later scope
proposals; this decision does not approve that roadmap.
