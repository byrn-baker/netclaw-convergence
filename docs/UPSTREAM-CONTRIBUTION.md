# Convergence upstream contribution

[Proposal #309](https://github.com/automateyournetwork/netclaw/pull/309) was merged
upstream on 30 October 2026 at `4d791a36`. It accepts the scope of one optional
read-only flow-evidence integration. The five specification documents ship no
runtime implementation; the clean upstream connector remains the next contribution.

## First milestone

An operator selects a retained traffic observation in NetClaw, then inspects the
latest records involving that address for the same window and exporters. The
proposed contribution is two read-only MCP tools, one optional HUD view, connection
guidance and the applicable installer/catalog/access tests.

Convergence continues to own collection, retention, dashboards, alerting and its
case API. NetClaw owns the connector and evidence presentation. No API server,
storage deployment, Helm chart, collector, case mutation or automatic investigation
is imported in the first slice. Those capabilities remain in the independently
operated fork and would need separate scope proposals before upstream inclusion.

The [source comparison and plan](https://github.com/byrn-baker/netclaw-convergence/tree/161-convergence-proposal/specs/161-convergence-proposal)
explain the incremental value beyond existing Grafana/Prometheus queries and
in-memory IPFIX reception, identify existing service endpoints and proposed new
files, and define credential, site, session, response-size and lifecycle boundaries.

Evidence includes an address as source OR destination; the latest 100 records may
not reproduce a directional ranking total. Display direction and limits explicitly.
Failed-refresh cached data is stale; old receipt timestamps alone do not establish
collector failure or missing capture coverage.

## Service distribution and attribution

The compatible API currently lives in this fork's `ui/convergence-api/`. The
original standalone Convergence repository does not contain that API. Before an
upstream connector ships, its guide must identify a public reproducible service
build/revision and retained-flow setup. See [provenance](convergence/provenance.md).
The fork's [K3s and Docker guides](CONVERGENCE.md) remain the installation entry point;
the core Docker trial collects no flows by default. Its opt-in
[home-lab paths](convergence/home-lab.md) add an isolated demonstration or explicitly
selected Linux host-interface exporter without special network hardware.

## Evidence and remaining gates

[Spec 1009](../specs/1009-convergence-onboarding/spec.md) established portable core
onboarding. [Spec 1010](../specs/1010-convergence-development/spec.md) added the
coding workflow. Both are merged into the fork; neither is an upstream feature release.

[Spec 1011](../specs/1011-convergence-readiness/spec.md) repairs inherited CI contracts
and adds a real-store flow/API/HUD component integration check. Historical missing
spec artifacts are explicitly reconstructed, not presented as original planning.
The [qualification matrix](convergence/verification.md) distinguishes actual checks
from untested host/runtime combinations.

[Spec 1012](../specs/1012-convergence-home-onboarding/spec.md) adds accessible Linux
onboarding and source coverage labels. Demo and host modes remain distinct; neither
requires Cisco equipment, Proxmox or Kubernetes.

Remaining gates are a coordinated implementation spec,
a clean upstream port and its own acceptance. Linux Docker/K3s tests are feasibility
evidence, not upstream compatibility proof. macOS Docker Desktop and Windows/WSL2
still need actual host execution; WSL2 awaits an accessible dedicated test VM.
Full browser/gateway/model investigations and real-device/capture coverage require
separate evidence and are outside the first read-only integration.

Keep unrelated fork history, additional MCP vendors, personality/model changes,
private topology, runtime state and generated credentials out of upstream ports.
