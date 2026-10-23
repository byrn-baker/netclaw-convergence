# Secure internal federation transport

Spec 124 closes a plaintext distributed-member transport gap. iN2N now listens
on `127.0.0.1` by default. Co-located members keep working over loopback.
Distributed members require verified TLS; remote plaintext is refused. This
change affects host federation services, not router configurations.

## Distributed Border

Provision a TLS certificate/key for the Border's DNS name (or an IP SAN if members
connect by address). Use your organization CA or a publicly trusted certificate.
Keep the private key readable only by the service account. A self-signed leaf
can be explicitly trusted by members if it has the correct SAN; never disable
hostname or certificate verification.

```bash
python3 scripts/migrate-in2n-transport.py --env-file ~/.openclaw/.env \
  --bind 0.0.0.0 --cert /secure/border.crt --key /secure/border.key
# Inspect the preview, then repeat with --apply.
```

For a narrower listener, replace `0.0.0.0` with the Border's management address.
The migration validates certificate/key loading before any writes and sets
`N2N_IN2N_BIND`, `N2N_IN2N_TLS_CERT`, and `N2N_IN2N_TLS_KEY`. It preserves the port,
member registry, tokens, keys, and unrelated environment settings.

## Distributed member

Set `N2N_BORDER_ENDPOINT` to the name/address covered by the Border certificate.
Remote endpoints automatically use verified TLS. System roots work without a
custom CA; for a private CA:

```bash
python3 scripts/migrate-in2n-transport.py --env-file ~/.openclaw/.env \
  --ca-file /secure/border-ca.pem
# Inspect the preview, then repeat with --apply.
```

`N2N_IN2N_CA_FILE` selects that trust file and `N2N_IN2N_TLS=true` also enables
TLS when connecting through loopback (for example a tunnel). TLS still validates
the endpoint hostname; use a hostname that matches the certificate.

Upgrade both Border and distributed members before restarting their daemons.
Possession and hub-attestation signatures now bind to the actual TLS channel;
old unbound TLS peers cannot authenticate. Plaintext loopback retains its prior
local-host trust model. Do not expose or port-forward a plaintext listener.

Verify member enrollment/reconnect, expected member identities, and a read-only
delegation. A successful socket connection alone is not authentication. The
migration does not create a CA, issue certificates, enroll members, or restart
services automatically.

## Backup and recovery

Apply creates a private `.env.pre-in2n-tls` backup and atomically writes mode 0600.
Repeating an unchanged migration is safe; a prior backup is never overwritten.
Preview/restore it with:

```bash
python3 scripts/migrate-in2n-transport.py --env-file ~/.openclaw/.env --restore
python3 scripts/migrate-in2n-transport.py --env-file ~/.openclaw/.env --restore --apply
```

Environment rollback does not disable the new remote-TLS requirement. Prefer
repairing certificate trust or temporarily co-locating members on loopback. An
old software rollback restores the plaintext exposure; it is not a secure recovery
option for distributed operation.
