# Production change verification

Spec124 blocks production writes unless ServiceNow confirms the **exact requested
CR** is approved and in **Implement** state. This applies to the gNMI, Claroty,
Fortinet and multivendor CLI change gates. A scheduled, closed, unapproved,
missing or unverifiable CR cannot authorize execution. Read operations are unaffected.

The previous gNMI/Claroty integration was a placeholder that allowed writes when
verification was unavailable. It now performs a verified HTTPS, read-only lookup.
The other gates now validate the CR number before querying and reject mismatched
records or approval in the wrong state. No migration creates or approves a CR.

Configure these settings privately:

- `SERVICENOW_INSTANCE_URL`: HTTPS instance base URL.
- `SERVICENOW_USERNAME` / `SERVICENOW_PASSWORD`: an account permitted to read the
  change records used for verification.

Preview and adopt the production settings:

```sh
python3 scripts/migrate-change-gates.py
python3 scripts/migrate-change-gates.py --apply
```

Use `--env-file` for another runtime. Apply refuses missing credentials or invalid
URLs before writing, preserves unrelated settings, sets `NETCLAW_LAB_MODE=false`,
and saves a mode0600 `.env.pre-change-gates` backup. Writes are atomic and repeat
runs are idempotent. Restart affected MCPs after applying. Preview restoration
with `--restore`; add `--apply` to restore. Restoring settings cannot restore the
old fail-open code; an old explicit lab-mode flag will return with its original value.

Existing explicit gNMI/Claroty lab mode is restricted to an isolated lab where
bypassing ServiceNow is intentional. It is not production approval. Do not turn it
on to work around ServiceNow downtime. Fortinet/multivendor retain their separate
write-enablement, human-approval, classification and baseline requirements.

After adoption, use a known approved Implement CR for verification through your
normal change process. A synthetic local test proves rejection/enforcement logic,
not your instance's access permissions or custom state mapping. Custom instance
states require an explicit reviewed mapping; unknown values deny execution.
