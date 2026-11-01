# Repository evidence

services/ids-ingest/server.py has authenticated EVE/status endpoints and independently
retried log/archive/case delivery. store.py already provides SQLite transactions,
capacity backpressure and per-target acknowledgements. Host events need their own
validator/namespace and heartbeat table; preserving EVE behavior is mandatory.
telemetry.py currently assumes every archive row is Suricata; add a typed branch.
The Dockerfile enumerates modules and must include the new module. Existing Helm
ids.yaml already mounts an operator-provided config Secret and serves HTTPS; no new
listener or public exposure is needed. Documentation must explain secret config and
that a prototype image must be built before this endpoint exists in an installation.

No live K3s/Proxmox inspection was performed. Owner-supplied network addresses and
mapping assertions are hypotheses for later live verification, not trusted state.
No new third-party API or dependency is needed for this code-only prototype.
