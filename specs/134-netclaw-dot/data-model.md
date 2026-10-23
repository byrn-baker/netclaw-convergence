# Proposed data model

- ConnectionProfile: local profile ID, enabled flag, synthetic/live mode, authenticated principal binding, alias allowlist, approved output-policy version, backend references. Secrets remain in local secret storage and never enter the model schema. Live mode disabled by default.
- ReadRequest: server-generated request ID, trusted principal, tool enum, validated alias list, UTC received time and deadline. Client text cannot assert trusted identity or change permissions.
- Observation: opaque alias, fixed check enum, outcome enum, observed_at UTC, source category, freshness, bounded finding code and optional safe summary. No raw CLI, IPs, hostnames, configurations or filesystem paths in hosted output.
- AuditRecord: request ID, principal reference, policy version, requested aliases, decision, start/end UTC, backend outcome and local evidence reference/hash. Audit is local/private. Returned audit status exposes only this request's permitted metadata.

Lifecycle: authenticate → validate scope/limits → write durable request audit → collect bounded reads → validate/classify output → record result → emit safe response. On audit failure refuse/withhold response; on partial backend failure preserve distinct outcomes. Alias changes invalidate prior scope bindings. Evidence retention must be documented and never imply hosted memory deletion on disconnect.
