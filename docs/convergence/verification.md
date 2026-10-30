# Installation qualification

This record describes the Convergence onboarding changes in spec 1009, tested on
30 October 2026. It is not a promise that every Kubernetes distribution, storage
backend, OS or network adapter works without qualification.

## Executed environment

| Component | Actual test environment |
|---|---|
| Host | Ubuntu 24.04.4 LTS, x86_64; Python 3.12.3 |
| Docker | Engine 29.5.3, Compose 5.1.4, local Linux-container daemon |
| K3s | v1.33.5-k3s1, disposable single-node cluster in k3d 5.9.0 |
| Helm | 4.3.1 fresh install/upgrade; 3.19.0 repeat upgrade |
| Storage | K3s local-path; independent Docker named volumes |
| Grafana | 12.3.3; private generated administrator credentials |
| API | Built from this checkout using its Node 24 Dockerfile; imported into K3s |

The disposable cluster used its own kubeconfig, namespace, release and synthetic
site. No existing production cluster, sensor, gateway or runtime was changed.

## Hosted architecture acceptance

[Run 41097779673](https://github.com/byrn-baker/netclaw-convergence/actions/runs/41097779673)
passed all four jobs at source commit `95482b37`:

| Native runner | Docker fresh install/restart | K3s fresh install/upgrade/restart |
|---|---|---|
| Ubuntu 24.04 x86_64 | PASS | PASS |
| Ubuntu 24.04 ARM64 | PASS | PASS |

The K3s jobs use **v1.37.1-k3s1**, k3d 5.9.0 and Helm 3.19.0. They build the API
natively on each architecture, verify authenticated/scoped case access and Grafana
queries, write/retrieve canaries, and prove case persistence after upgrade and a
PostgreSQL restart. Helm tests also exercise metric/log and OTLP round-trips.
This qualifies those Linux test environments, not macOS/WSL2 host behavior or
mixed-architecture scheduling.

## Observed results

- **40 automated tests passed** across the setup helper contracts and Helm chart
  suite. They include private credentials, rerun preservation, incomplete/mismatched
  bundles, explicit contexts, foreign Secret rejection, portable storage rendering,
  optional Grafana and existing shared-Grafana behavior.
- **Docker fresh install passed** with alternate ports/site, a private bundle path
  containing spaces and deliberately conflicting exported `PGPASSWORD`, `API_KEYS`
  and `COMPOSE_PROFILES`. Only the six selected trial services started.
- A second core-only Docker project also passed from a clean detached checkout whose
  path contained spaces, with a separate site/network/volumes while the first
  project remained running.
- **K3s fresh install passed** using a source-built image, non-default namespace,
  release and site, all eight PVCs on local-path, and no existing Grafana.
- Both paths passed authenticated case access, unauthenticated/wrong-site rejection,
  API probe ingestion, dashboard provisioning and an actual Grafana datasource query.
- Both paths passed synthetic case creation/read/archive and persistence after
  restart. The Docker startup race found during testing was corrected with a startup
  wait and bounded read-only verification retries; the same restart sequence passed.
- K3s passed repeat Helm upgrade, PostgreSQL/Grafana pod restart and the previous
  canary persistence check. Helm's test also passed direct metric/log and OTLP
  metric/log round-trips. The setup verifier independently tested OTLP logs.
- PostgreSQL was logically dumped and restored into a separate test database;
  the synthetic case was present. This is not full multi-store disaster recovery.
- Helm uninstall retained eight PVCs and the external credentials Secret. Reinstall
  with the original bundle passed verification and read the original case.
- A Chromium browser logged into the Docker Grafana and displayed the provisioned
  installation-health dashboard with live series and no page JavaScript errors.
- Catalog metadata and generated-catalog parity passed. The existing fork-wide
  artifact/declaration baseline is reported separately in spec verification.

## Platform and capability limits

| Combination | Qualification |
|---|---|
| Linux x86_64 and ARM64 Docker trial | Executed locally/on native hosted runners as above |
| K3s on x86_64 and ARM64, local-path | Executed in k3d, including current v1.37.1; native-node installation/import instructions reviewed |
| Helm 3 / Helm 4 | Both exercised against the disposable K3s release |
| macOS Docker Desktop | Guide reviewed; actual host run still required |
| Windows WSL2 + Docker Desktop | Guide reviewed; actual host run still required |
| Mixed-architecture cluster | Native images work separately; combined registry manifest and cross-node scheduling still require qualification |
| Shared Grafana | Existing merge/render contracts pass; fresh guide does not mutate an existing Grafana |
| Device telemetry, IDS, Guardian | Outside core onboarding tests; require source/capture/model-specific acceptance |
| Public ingress, arbitrary migrations, air-gap, full disaster recovery | Not qualified by this test run |

Use the [setup acceptance checklist](../../workspace/skills/convergence-setup/references/acceptance.md)
for a real installation. Only mark selected layers ready when their evidence exists.

## Repeat the core checks

```bash
python3 -m pytest tests/unit/test_convergence_setup.py \
  tests/unit/test_convergence_setup_k3s.py tests/unit/test_convergence_setup_verify.py \
  deploy/helm/tests/test_charts.py -q
python3 scripts/build-catalog.py --check
python3 scripts/check-catalog-metadata.py
```

The chart tests need Helm and built chart dependencies. The Python tests need
pytest/PyYAML in a dedicated development environment; end-user setup helpers need
only Python's standard library. For actual fresh-install checks, follow the
[Docker](docker.md) or [K3s](k3s.md) guide with new isolated identities and run
`verify.py --canary`, then restart/upgrade and verify again. Never point destructive
acceptance steps at a live installation.
