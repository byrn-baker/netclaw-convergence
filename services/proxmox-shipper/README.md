# Proxmox snapshot shipper

Run this on the management backend, outside the customer guests. It reads the passive observer's bounded snapshot through an existing pinned SSH connection and publishes it to the separate hypervisor evidence endpoint using validated HTTPS and a dedicated publisher credential. No new hypervisor listener or token is needed.

Configure a root-owned JSON file with `url` (HTTPS `/v1/hypervisor-events`), `node`, `ssh_host` (`root@management-address`), absolute `identity_file`, `known_hosts_file`, `ca_file`, `status_file` and optional `interval_seconds` (5–60, default15). The service uses systemd `LoadCredential=ingest-token`; an explicit `token_file` is available for controlled one-shot validation. Keep the token out of command arguments, source control and logs. The receiver stores only its SHA-256 hash. Configure the trusted site and node in the receiver; they are not caller-controlled tenant claims.

The supplied unit runs as the existing backend SSH operator with a read-only home, strict host-key checking, no privilege escalation, CPU5% and memory96MiB. Keep only the verified Proxmox host key(s) in the configured known-hosts file. Install the observer first, initially with a restricted test-VM capture list. Verify real snapshots against the receiver before publication, then activate the shipper. Verify receiver freshness and the Convergence Security card before broadening capture.

Snapshots represent bounded rolling observations, not a complete replay queue. A disconnected or overloaded pipeline can lose connection metadata; interface counters remain cumulative and status becomes stale after60seconds. The receiver retains bounded snapshot-observation history, not unique-connection counts. No case creation or quarantine is performed.

Rollback: stop/disable this unit and the Proxmox observer, retain evidence for inspection, restore the previous managed API/ingest image digests and HUD backup, and remove only this source's receiver configuration using a resource-version-checked update. Do not remove or reset unrelated source credentials or VM firewall state.
