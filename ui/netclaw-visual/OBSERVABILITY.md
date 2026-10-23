# Optional observability context — first implementation

The terminal remains a normal SSH terminal. This opt-in layer reads vendor APIs
in the background, caches bounded evidence and displays matching evidence in the
existing hover / side pane. It does not change device configurations, pyATS,
SSH transport, CML addressing, or existing collector authorization.

## Open it

Restart the **NetClaw API**, refresh Canvas, and select the terminal menu
**Extra Features → Observability integrations**. Enter endpoint, read-only
credential and scope, review the consent checkbox, then choose **Authorize and
connect**. Configuration alone is not a successful connection: the status becomes
**Verified API response** only after a successful response of the expected shape.
This is not proof of complete inventory, current device state, or production readiness.

Credentials and all new integration state live only in API memory. Restarting the
API disables these integrations and clears the cache. Closing the dialog does not
stop polling. **Disable and clear cache** revokes polling and discards cached
records; an in-flight response cannot restore them. These settings apply to all
Canvas windows attached to this API, not to an individual browser tab.

## What is implemented

| Integration | Current read / export | Scope and boundaries |
| --- | --- | --- |
| Infoblox NIOS | IPv4 network allocations and comments via WAPI | One explicit network view; first 200 networks. Not DHCP leases, DNS host records, or BloxOne APIs. |
| ThousandEyes | Latest existing network-test results: target IP, agent, measurement time, RTT, loss, jitter when present | One account group; 1–5 numeric test IDs; first 200 results per test. No test creation, active probes, or hostname-to-IP guessing. |
| Kubernetes | Pod IPs, namespace, node and phase | One namespace; first 200 pods. No secrets, pod exec, cluster-wide discovery, kubeconfig loading, or automatic token rotation. |
| OpenTelemetry | Outbound OTLP/HTTP JSON health metrics | Exact `/v1/metrics` endpoint; no gRPC, trace/log export, OTLP ingestion or vendor telemetry forwarding yet. |
| VMware vCenter | Planned adapter, visibly marked in GUI | No vCenter API calls yet. Existing NetClaw VMware tools are unchanged. |
| ExtraHop | Planned adapter, visibly marked in GUI | No ExtraHop API calls yet. |

Infoblox can explicitly reuse `INFOBLOX_URL`, `INFOBLOX_USERNAME` and
`INFOBLOX_PASSWORD` from NetClaw's existing environment configuration. ThousandEyes
can reuse `TE_TOKEN`, only against `https://api.thousandeyes.com/v7`. Alternatively,
enter session credentials in the GUI. The new endpoints never return these secrets.
Updating a provider requires supplying credentials again or selecting the existing
environment source. Use read-only vendor roles.

Polling defaults to **300 seconds**, accepts 60–3600, runs after each completed
request, adds jitter and exponentially backs off failures (up to one hour).
Authentication/authorization rejection pauses that provider until reauthorized.
There is one configured source per provider, with no overlapping requests per
source, a 30-second collection deadline and 2 MB response limit per request.
Partial pages are labeled; no silent claim of full fleet coverage. A failed
collection retains the previous snapshot, explicitly labeled stale in the pane.

## Evidence and privacy

- Hover performs local cache lookups only. It does not call external providers or run CLI.
- IP/subnet containment is supported for IPv4 and IPv6. Infoblox's initial adapter
  collects IPv4 networks only. At most 40 matching records are shown, with a count
  when truncated; narrowing the selected prefix can help.
- Provider/source, collection time, measurement time when available, scope and
  cache staleness remain visible. Cache age is not measurement age.
- Inventory allocations, observed test targets, and shared pod addresses are
  explicitly distinguished from router-reported data and actual IP ownership.
- Site/VRF context is a **manual annotation**, not a verified join. Overlapping
  address spaces must be checked against scope; this version does not merge them
  into a single authoritative device identity.
- No raw vendor payload, CLI transcript, IP, hostname, credential or scope label
  is included in OTel exports. Only `service.name=netclaw`, fixed provider IDs,
  integration-health gauges, cached-record counts and a heartbeat are exported.
- HTTP is accepted only for loopback development endpoints. Other endpoints
  require HTTPS with trusted certificates; redirects are rejected. For a private
  CA, configure the Node process trust store (for example `NODE_EXTRA_CA_CERTS`)
  before startup; never disable TLS verification.
- The new API is localhost-only, using the same request guard as the terminal.
  This is **not** a multi-user RBAC boundary. Do not expose NetClaw directly to a
  shared network as a production service without authenticated access controls.

## Optional OTel Collector on Kubernetes

Kubernetes is not required. An existing local or remote authenticated OTel
Collector accepting OTLP/HTTP JSON metrics also works. This first export measures
the **new integration layer**, not the SSH topology collector or device health.

`deploy/observability/collector-values.yaml` is a lab starter for the official
Collector Helm chart, not an automatically installed dependency. It receives on
pod loopback, has a bounded metrics pipeline and uses the debug exporter as a
delivery check. It is not a time-series database or production backend. Pin a
reviewed chart/image version and render/review the chart before installation.
Example commands (replace the version placeholder; these have not been run):

```powershell
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
helm template netclaw-otel open-telemetry/opentelemetry-collector --version <reviewed-chart-version> --namespace observability -f deploy/observability/collector-values.yaml
helm upgrade --install netclaw-otel open-telemetry/opentelemetry-collector --version <reviewed-chart-version> --namespace observability --create-namespace -f deploy/observability/collector-values.yaml
kubectl -n observability port-forward deployment/netclaw-otel 4318:4318 --address 127.0.0.1
```

Then select **OpenTelemetry export** in the GUI, authorize
`http://localhost:4318/v1/metrics`, and check the Collector's logs. Successful
HTTP delivery is not proof that a downstream backend stored the metrics. Partial
acceptance is surfaced as an error. No export queue persists across restarts.

For production, replace the debug exporter with your approved backend, configure
TLS/authentication and egress policy, use secret management, and decide which
collectors own each polling scope to prevent duplicate collection. Deploying
multiple NetClaw replicas currently duplicates polling; there is no distributed
lease or edge-collector control plane yet. Anycast is not required and is not a
substitute for stateful collector assignment.

The independent `pod-reader-rbac.yaml` example grants only namespace-scoped pod
listing for the Kubernetes **context** adapter. Review/change its namespace and
have your cluster administrator provision a short-lived token; enter that token
in the GUI. The adapter does not fetch or mint tokens. Expired tokens pause polling.
Neither example is applied automatically.

## Verification and next increments

Run `npm run test:observability` and `npm run build`. Tests use synthetic vendor
responses, verify cache-only hover, prefix matching, authorization, secret
redaction, cancellation, response bounds and OTLP payloads. The browser fixture at
`http://localhost:3000/test/observability.html` uses **fake data only** and blocks
real API calls; it is not part of the production bundle. No live vendor system or
Kubernetes deployment was used to verify this first slice.

Next increments: VMware and ExtraHop adapters, explicit site/VRF mappings, paginated
multi-source collection, persistent encrypted credentials / enterprise identity,
edge-worker leases, and telemetry-store query adapters for flow/SNMP/syslog context.
Raw NetFlow/sFlow/IPFIX ingestion belongs in dedicated telemetry pipelines rather
than in the terminal process. OTel transport does not itself make every vendor's
inventory and identity model interchangeable.

## API references

- [NIOS WAPI reference](https://docs.infoblox.com/download/attachments/15433773/Infoblox%20NIOS%20WAPI%209.x%20Reference%20Guide.pdf)
- [ThousandEyes network results](https://developer.cisco.com/docs/thousandeyes/v7/get-network-test-results/)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [OTLP specification](https://opentelemetry.io/docs/specs/otlp/)
- [Official OTel Collector Helm chart](https://opentelemetry.io/docs/platforms/kubernetes/helm/collector/)
