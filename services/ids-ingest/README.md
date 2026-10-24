# IDS ingestion

Single-process FastAPI service accepting Suricata EVE batches over HTTPS.
See the [complete setup, validation and recovery runbook](../../docs/runbooks/convergence-ids.md).

* `POST /v1/eve`: per-sensor Bearer credential; body `{events: [...], heartbeat: {...}}`.
  Sensor/site identity comes from the credential's server-side configuration.
  Maximum 256 records / 1 MiB per batch / 256 KiB per record. Atomic durable
  acceptance returns `{status: "accepted", received, inserted}`. Retry on 503;
  preserve the batch and investigate on 400/413.
* `GET /v1/status?site=...`: separate status-reader Bearer credential, held only
  by the trusted Convergence API. The API enforces the operator's site scope.
* `GET /healthz`: process liveness only. It does not assert capture coverage.

SQLite stores raw EVE, independent log/case delivery checkpoints, and sensor
health. Delivery retries without expiring pending records. Use one Uvicorn worker
and durable local storage. Credentials and TLS keys are generated outside source
control by `deploy/convergence/ids/prepare-ingest.py`.

Run tests from the repository root:

```bash
.venv/bin/python -m unittest discover -s services/ids-ingest -v
```
