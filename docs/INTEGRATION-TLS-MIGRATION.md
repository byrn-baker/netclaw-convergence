# Verified integration transport

Spec124 enables certificate verification for the first-party Nautobot clients and
ANTA. ANTA additionally verifies the eAPI hostname. Previously its wrapper set an
SSH option while reporting HTTPS verification, so `tls_verified=true` did not
establish HTTPS trust. ANTA now requires1.10 or later within the supported1.x series.

Preview each configured integration, then apply:

```sh
python3 scripts/migrate-integration-tls.py --service nautobot --ca-bundle /absolute/path/private-ca.pem
python3 scripts/migrate-integration-tls.py --service nautobot --ca-bundle /absolute/path/private-ca.pem --apply
python3 scripts/migrate-integration-tls.py --service anta --ca-bundle /absolute/path/eos-ca.pem
python3 scripts/migrate-integration-tls.py --service anta --ca-bundle /absolute/path/eos-ca.pem --apply
```

Omit `--ca-bundle` when the normal trust store already trusts the service. Obtain
private/self-signed CA certificates independently; migration validates the PEM
file without contacting the service. Nautobot uses `NAUTOBOT_CA_BUNDLE`. ANTA uses
`ANTA_CA_BUNDLE`, which adds private CA trust to its verified eAPI context. Restart the selected MCP after applying.

Each service has a separate mode0600 backup (`.env.pre-nautobot-tls` or
`.env.pre-anta-tls`). Credentials and unrelated settings are preserved, writes
are atomic, and repeat runs are idempotent. `--env-file` selects a nondefault
runtime. Preview rollback with `--restore`; add `--apply` to restore the backup.

An explicit `--lab-insecure` override is available for an accepted isolated lab
exception and cannot be combined with `--ca-bundle`. It disables certificate
verification and cannot establish trustworthy operational evidence. ANTA discloses
the override in its results and retains SSH host-key verification independently.

The same CLI handles `--service redfish`; see [Redfish migration](REDFISH-TLS-MIGRATION.md).
Environment files are data; see [environment handling](ENVIRONMENT-FILES.md).
