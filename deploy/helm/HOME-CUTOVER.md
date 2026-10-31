# Home Convergence on K3s

The production release is `netclaw-convergence/convergence`, managed by Argo CD using
`profiles/convergence-home-live.yaml` followed by
`profiles/convergence-home-argocd.yaml`. Keep the original home profile for previews;
it federates Docker metrics and suppresses alert delivery and must not replace live values.

## Ownership and endpoints

| Workload | Production location |
|---|---|
| Metrics, VictoriaLogs, Loki, PostgreSQL cases | K3s, `netclaw-convergence` |
| IDS ingest database, delivery checkpoints, IPinfo update | K3s, `convergence-ids` and `convergence-ip-context` |
| SNMP, probes, UniFi, rules and Alertmanager | K3s, Argo-managed project chart |
| WAN speed test | One hourly `observability/speedtest` CronJob; both metrics stacks scrape its shared Pushgateway |
| GoFlow2 capture | Existing `observability` namespace |
| Flow log forwarding | Project DaemonSet; retains original host-file checkpoints |
| Shared Grafana | Existing `observability/grafana` |
| Suricata and capture spool | `home-ids-01`, 192.168.3.200 |
| NetClaw gateway, member, alert receiver, HUD | NetClaw VM, 192.168.3.252 |
| Syslog relay and host-log forwarding | VM, `host-relay/docker-compose.yml` |

The VM's forwarding queue is bounded to 512 batches of at most 512 records.
It is a retry buffer, not the authoritative log database. Host journal/agent log
files, receiver work queue and agent runtime state still belong on this VM.
The sensor keeps unacknowledged capture files locally until delivery succeeds.

| Consumer | URL |
|---|---|
| HUD and agent case API | `http://192.168.13.12:30081` |
| Sensor EVE ingestion | `https://192.168.13.12:30445/v1/eve` |
| Agent PromQL | `http://192.168.13.12:30429` |
| Agent LogSQL | `http://192.168.13.12:30428` |
| Agent LogQL / host Promtail | `http://192.168.13.12:30310` |
| VM OTLP relay | `http://192.168.13.12:30318` |
| Shared Grafana | `https://grafana.internal.byrnbaker.me` |

IDS uses the original private CA, sensor token and status credentials. API JWT and
API keys were carried across, so existing users and agents retain access. Credentials
are independently managed Kubernetes Secrets, never Helm values. NodePorts are
home-network endpoints, not public Internet services.

## Storage

`profiles/convergence-home-storage.yaml` provisions retained Longhorn claims:
VictoriaLogs 1 TiB, Loki 100 GiB, IDS 100 GiB and migration backups 100 GiB.
Existing PostgreSQL (10 GiB) and VictoriaMetrics (20 GiB) claims continue in use.
Metrics and VictoriaLogs retain 365 days; Loki retains 14 days.
The SSD class uses two replicas on two disks of the Mac mini. This protects
against a disk failure, **not loss of that whole host**. Copy backups to another
machine before treating this as host disaster recovery.

## Upgrade through Git

The home release is owned by the Argo CD `convergence` Application. Do not run
`helm upgrade`, `helm rollback` or `helm uninstall` against it. Helm's retained
revision 14 is pre-adoption history, not current deployment status.

```sh
python3 deploy/helm/scripts/sync-assets.py --check
python3 deploy/helm/scripts/build-live-profile.py --check
helm dependency build deploy/helm/convergence
helm template convergence deploy/helm/convergence -n netclaw-convergence \
  -f deploy/helm/profiles/convergence-home-live.yaml \
  -f deploy/helm/profiles/convergence-home-argocd.yaml --skip-tests
```

Build API/IDS images from their source, publish them to the private GHCR packages,
and update the digest pins in the Argo overlay. Review, commit and push the chart
or values changes; Argo syncs and self-heals with automatic pruning disabled.
The `ghcr-pull` Secret is provisioned externally. Validate actual HUD, security,
flow and Grafana queries after the rollout.

Shared Grafana configuration belongs to the `observability` Application in
`/home/ubuntu/k3s-observability-stack/gitops/home/observability`. The project's
registration mode is `external`; use `scripts/merge-grafana-gitops.py` to merge
rendered bundles into those tracked manifests. See the Helm README for usage.

The VM relay remains independently operated with
`docker compose -f deploy/helm/host-relay/docker-compose.yml up -d` when its
configuration changes. Never apply the retired full Docker Compose stack: it
would restart duplicate databases, polling and alert evaluation.

## Migration and rollback evidence

The cutover freezes writers before the final log/SQLite copy, preserves delivery
checkpoints, restores PostgreSQL with the original credentials, imports VictoriaMetrics
native history and Prometheus remote-read history, and then redirects producers.
PostgreSQL row counts and content digests are compared before new writes begin.
The IDS copy is compared byte-for-byte using SHA-256. Original stores are archived
off the VM, with matching sender/receiver checksums, before local removal.

Private rollback configuration and database dumps are kept in the retained
`convergence-migration-backup` PVC. The local ignored
`deploy/helm/private/cutover` directory contains the migration manifest and a small
copy of configuration evidence. Treat both as secret material. Temporary SSH and
migration workloads must be removed after verification; the backup PVC stays.

Disable Argo automated reconciliation in Git before any manual recovery.
A Helm rollback cannot reverse this migration: it does not restore external
client URLs, Secrets or historical state. For rollback, stop new writers, take a
fresh cluster backup, restore the required cold archives to their original paths,
restore the saved Secrets/environment files, and restart the original Docker/IDS
services. Replay or migrate records accepted after cutover before switching readers
back. Never start both IDS writers against the same SQLite file or reset sensor
shipping cursors to accelerate rollback.

During cutover, the live-priority cursor was rediscovered near the latest file tail
after its 72 MB outage backlog. All original history cursors stayed unchanged;
the skipped live prefix remains covered by normal historical replay. A sensor-side
SQLite backup preserves the previous live cursor.

IDS cleanup now scans bounded rowid batches with a durable cursor, avoiding a
full retained-history scan on the request loop. Log/archive delivery uses 512-row
batches; case delivery retains its 128-row acknowledgement boundary.

References: [VictoriaLogs backup/restore](https://docs.victoriametrics.com/victorialogs/#backup-and-restore),
[Prometheus remote-read migration](https://docs.victoriametrics.com/victoriametrics/vmctl/remoteread/),
[VictoriaMetrics native migration](https://docs.victoriametrics.com/victoriametrics/vmctl/victoriametrics/).


## Cutover verification — 2026-10-30 UTC

- Restored 62,538 case rows, 158 history rows and one site; source and target
  content digests matched before resuming writers.
- Copied 5,067,842 retained IDS records. The frozen SQLite source passed
  `quick_check`; the target's 16,406,724,608-byte file matched its SHA-256 before
  ingestion resumed. Delivery checkpoints and IP context data were retained.
- Imported 139,908,856 historical Prometheus samples plus 211,708 final-delta
  samples, with no importer retries; also imported native VictoriaMetrics history.
- Verified current SNMP from all three switches (304 ports), four access points,
  WAN probes, speed tests, firewall logs, NetFlow and authenticated IDS metrics.
  Historical interface samples remain queryable after Docker is stopped.
- Browser checks rendered all 304 ports and populated Security case groups.
  Shared Grafana reports all three project data sources healthy. Helm's metric,
  log and both OTLP round-trip tests passed. Eight chart tests and 36 IDS tests pass.
- The sensor can remain `degraded` while the preserved Loki delivery backlog
  drains. Fresh heartbeats, capture statistics, case delivery and VictoriaLogs
  archival are verified separately; a backlog is not reported as healthy capture
  coverage. Capture source limitations remain unchanged.

The API explicitly points both its Prometheus and VictoriaMetrics query clients
at the project metrics service. After a failed Helm apply that updates workload
checksums before updating ConfigMaps, restart the affected collector/agent/rule
workloads once the ConfigMaps are reconciled; a successful follow-up Helm status
alone does not prove a process reloaded its configuration.

Local cleanup removed 13 retired containers, eight named database
volumes and the archived IDS state directory. Measured recovery was
36.6 GiB; the VM now has approximately
43.6 GiB free (69% used). Only the two project forwarding
containers remain. Cold archives and their checksums are retained on the backup
PVC; the temporary SSH/migration service is removed after final verification.

## WAN speed-test ownership

The home deployment runs one auto-nearest Ookla test per hour through the existing
`observability/speedtest` CronJob. Its GitOps server list contains only auto-nearest.
Convergence scrapes that series from `pushgateway.observability.svc.cluster.local:9091`,
retaining its server/provider labels. Its own speed-test Deployment stays managed at
zero replicas because Argo pruning is disabled. Other project installations retain
the opt-in standalone runner with one replica.

The former two runners attempted four tests per hour and received provider rate
limits. A rejected attempt reports `speedtest_up=0`; current throughput can be absent.
Historical successful samples remain in metrics storage. Preserving old values in
the live Pushgateway requires corresponding stale-result handling in consumers and
is not part of this scheduling repair. Do not retry rapidly or bypass provider limits.

## Probe configuration reloads

The blackbox exporter reads its modules at startup. Updating the mounted ConfigMap
alone does not reload the running process. The chart hashes only the blackbox
configuration into its pod template so Argo rolls that exporter when modules change.
A successful exporter scrape (`up=1`) is separate from a successful target probe
(`probe_success=1`). The pfSense device tile follows the target probe.

On 2026-10-31 the mounted configuration included the existing private-certificate
probe policy, but the process still held its original defaults and rejected the
firewall certificate's missing IP SAN. Reloading the already-declared configuration
restored HTTP200 and probe success. Firewall configuration and certificate were not
changed. The configuration hash prevents that stale-process mismatch on later syncs.
