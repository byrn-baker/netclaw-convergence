# Home Convergence on K3s

The production release is `netclaw-convergence/convergence`, installed with
`profiles/convergence-home-live.yaml`. Keep the original home profile for previews;
it federates Docker metrics and suppresses alert delivery and must not replace live values.

## Ownership and endpoints

| Workload | Production location |
|---|---|
| Metrics, VictoriaLogs, Loki, PostgreSQL cases | K3s, `netclaw-convergence` |
| IDS ingest database, delivery checkpoints, IPinfo update | K3s, `convergence-ids` and `convergence-ip-context` |
| SNMP, probes, UniFi, speed tests, rules and Alertmanager | K3s, project Helm release |
| GoFlow2 capture | Existing `observability` namespace |
| Flow log forwarding | Project Helm DaemonSet; retains original host-file checkpoints |
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

## Upgrade

```sh
export KUBECONFIG=/home/ubuntu/k3s-observability-stack/kubeconfig
python3 deploy/helm/scripts/sync-assets.py --check
python3 deploy/helm/scripts/build-live-profile.py --check
helm dependency build deploy/helm/victoria-stack
helm dependency build deploy/helm/convergence
helm upgrade convergence deploy/helm/convergence -n netclaw-convergence \
  -f deploy/helm/profiles/convergence-home-live.yaml --wait --timeout 12m
docker compose -f deploy/helm/host-relay/docker-compose.yml up -d
```

Build IDS from the repository root (`docker build -f services/ids-ingest/Dockerfile`),
load the versioned image onto its scheduled node using `scripts/load-api-image.sh`,
and update the live profile generator's image tag before upgrading. The API uses its
own existing image. Never apply the retired full Docker Compose stack: it would
restart duplicate databases, polling and alert evaluation.

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

A Helm rollback alone cannot reverse this migration: it does not restore external
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
