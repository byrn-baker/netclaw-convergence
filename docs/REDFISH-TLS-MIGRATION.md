# Redfish certificate verification

Spec 124 verifies BMC HTTPS certificates by default. BMC credentials and hardware
readings require an authenticated transport even on private networks. HTTP mock
services remain supported for isolated tests.

For private PKI or a self-signed BMC, obtain its trusted CA certificate through an
independent trusted channel. Preview and apply the migration:

```sh
python3 scripts/migrate-integration-tls.py --ca-bundle /absolute/path/bmc-ca.pem
python3 scripts/migrate-integration-tls.py --ca-bundle /absolute/path/bmc-ca.pem --apply
```

For an already trusted public certificate, omit `--ca-bundle`. The script validates
the CA file, preserves credentials and unrelated settings, saves an exclusive
mode-0600 `.env.pre-redfish-tls` backup, writes atomically, and is idempotent.
Use `--env-file` for a nondefault runtime. Restart Redfish MCP after applying.
No BMC is contacted and no hardware state is changed by migration.

`--lab-insecure` explicitly disables verification and cannot be combined with
`--ca-bundle`. Every result discloses the exception. Use only for an isolated lab
where that unauthenticated transport is accepted; do not use it to silently work
around a certificate error. Redirects are refused: configure the final BMC URL.

Preview rollback with `--restore`; restore with `--restore --apply`. Restoration
recovers the old settings, so an old explicit insecure override also returns.
The retained backup is not overwritten by subsequent migrations.
