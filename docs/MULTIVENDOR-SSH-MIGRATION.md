# Multivendor SSH identity migration

Spec 124 makes SSH host-key checking mandatory by default for multivendor raw
reads, normalized reads and gated writes. Unknown or changed identities fail
before a command runs. Existing users must supply independently verified host keys.

Obtain each public host key through a trusted console or administrator and compare
its fingerprint independently. A bare `ssh-keyscan` result is not proof of identity.
For a nonstandard SSH port, the known_hosts name is `[hostname]:port`.

Preview, apply and restart the multivendor MCP:

```sh
python3 scripts/migrate-ssh-trust.py --env-file ~/.openclaw/.env --known-hosts ~/.ssh/known_hosts
python3 scripts/migrate-ssh-trust.py --env-file ~/.openclaw/.env --known-hosts ~/.ssh/known_hosts --apply
```

The script preserves unrelated settings, writes mode 0600, keeps a private
`.env.pre-ssh-trust` backup and is idempotent. It neither connects to devices nor
learns keys. Recovery is `--restore` to preview, then `--restore --apply`; this
restores the entire saved environment, so preserve any later edits first.

Netmiko drivers load the standard known_hosts file and the optional
`MULTIVENDOR_KNOWN_HOSTS` file. The NAPALM Junos adapter uses PyEZ's verified
connection and **the standard `~/.ssh/known_hosts` file**; install its trusted keys
there. An incompatible Junos SDK fails before connection. EOS normalized reads
use SSH. `MULTIVENDOR_<DEVICE_NAME>_PORT` supports alternate SSH ports, with dashes
in device names replaced by underscores.

An explicit `MULTIVENDOR_SSH_STRICT=false` is available only for disposable lab
compatibility; it disables identity checking and is disclosed in tool results as
`ssh_host_key_checking: false`. The migration always enables checking.

Raw `run_command` remains read-only even with `MULTIVENDOR_WRITE_ENABLED=true`.
Move configuration automation to `apply_config`, which retains baseline, approval,
change-request and verification gates. See [change-gate migration](CHANGE-GATE-MIGRATION.md).

New baselines and audit files are mode 0600 in a mode 0700 baseline directory.
Each baseline has a unique name. Previously copied/exported baseline files are
outside this protection and should remain in private operator storage.
