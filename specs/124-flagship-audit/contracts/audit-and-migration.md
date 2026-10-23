# Audit and migration contracts

## Audit report

Every area reports scope and method. Severity is distinct from verification status. No-data, unavailable, failed and successful checks are distinct. Raw secret values, private topology and credentials never appear in committed artifacts or external calls. A machine-readable coverage inventory supplements a human finding ledger and verification table.

## Existing interfaces

Retain existing MCP tool names/schemas, CLI commands and documented data formats unless a finding demonstrates a sufficient reason to change them. A migration is not required for an internal bug fix with unchanged user-owned state; document why. Protected writes remain gated on the owning authorization/change-control path across every entry point.

## Breaking-change migration

Each script must expose help and a no-write preview, validate source/target applicability, stop on incompatible or ambiguous state, create a protected backup before writes, avoid secrets in output, tolerate repeat invocation and report verifiable postconditions. Recovery must restore the captured state and report limitations; do not promise rollback of external irreversible side effects. CLI particulars belong in a finding-specific contract amendment before implementation.

## Platform acceptance

Required: macOS, Linux and WSL2. Native Windows is not a full host. Component-specific platform restrictions must be stated. A Linux run does not prove WSL2, and source review does not prove device integration. Record missing host evidence as blocked.

## A124-001 HUD access migration

The default HUD is a local trusted-operator application, not a remotely authenticated multi-user service. Bind API and Vite to 127.0.0.1, reject non-loopback clients, require Host and any browser Origin to name configured loopback ports, reject cross-site Fetch Metadata. WebSocket upgrades use the same checks. Do not trust forwarded headers. API port defaults 3001; frontend port defaults 3000; configure with HUD_PORT/HUD_UI_PORT.

Migration CLI: `python3 scripts/migrate-hud-access.py --ssh-target user@host` previews a shell-safe SSH command forwarding both ports. `--connect` executes the validated command as argv with ExitOnForwardFailure, no shell interpolation and no agent forwarding. Optional --ui-port and --api-port must be distinct valid TCP ports. It creates no configuration/data files and alters no existing user state, so backup/restore are not applicable; closing the SSH process reverses the connection. It rejects malformed/option-like targets and ports before spawning anything. SSH host-key authentication remains enabled. Existing deployments needing public exposure require a separately designed authenticated deployment, not an insecure opt-out.

## Voice authentication migration (A124-018/019)

`scripts/migrate-voice-auth.py --env-file PATH --public-url https://HOST` previews configuration changes without printing values or writing. `--apply` creates a restricted backup, preserves unrelated settings, obtains TWILIO_AUTH_TOKEN from existing file/process environment or a hidden terminal prompt, generates VOICE_ALERT_TOKEN only if absent, and records the public origin in VOICE_WEBHOOK_URL. Existing explicit gateway tokens are preserved; a missing token is reported for separate setup, never replaced by a shared default. Repeat apply with the same settings leaves bytes unchanged. Writes are atomic with mode0600; invalid URLs, symlinks/nonregular files or an existing backup fail before mutation. Restart the webhook service after apply. Configure alert senders with the bearer token locally. Revert configuration from backup if necessary, but do not restore unauthenticated code to public exposure. CML HTTPS validates by default; provide CML_CA_BUNDLE or explicitly opt out only for an operator-approved lab.

## Additional verified migration interfaces

| Finding | Executable interface | Retention/recovery |
|---|---|---|
|021|migrate-pyats-http.py (see --help and docs/PYATS-HTTP-MIGRATION.md)|Private pre-pyats-http environment backup; existing testbed preserved; dedicated MCP2 runtime|
|022|migrate-in2n-transport.py|Preview/apply/restore; verified remote TLS, loopback default; preserve credentials|
|025–026|migrate-zoom-auth.py|Preview/apply/restore; retain provider-issued secret and app credentials, never generate substitutes|
|028|write-env.py|Literal dotenv data, stdin secret values, atomic0600write, symlink refusal; migrations share codec|
|030,036|migrate-integration-tls.py --service redfish\|nautobot\|anta|Verified default, optional validated CA, explicit lab-insecure; per-service private backup/restore|
|037|migrate-change-gates.py|Read-only preview of missing setting names; apply requires configured HTTPS ServiceNow credentials; NETCLAW_LAB_MODE=false; private backup/restore; no CR creation|
|038–039|migrate-ssh-trust.py --known-hosts PATH|No network key learning; strict policy, private environment backup/restore; Junos keys must exist in standard known_hosts; raw writes move to apply_config|
|040|gait-venv-setup.sh --preview, normal setup, --restore|Stage/verify generation before promotion; retain .previous; repeat verifies without rebuild; explicit --rebuild cannot overwrite recovery point; no global install|
|041|Existing Python runtime migration guide and constrained pip helper|No automatic system-package override; select isolated interpreter/runtime explicitly; existing packages are not removed|

RAG/GCF/client lifecycle fixes preserve persisted schemas and need no user-data conversion. The stronger authorization/transport policies intentionally reject previously insecure calls. Backups restore configuration/runtime state, not remote side effects. Environment restore replaces the entire saved file only when its current digest matches the migration journal or the saved original. Later edits and legacy backups without matching metadata require manual comparison; restore refuses to overwrite them. Reverse-order rollback preserves intervening migration states.

A124-049 test preparation is an internal runtime-isolation change: old operator .venv directories stay untouched. Only explicitly owned test caches are refreshed, with recovery on failure. A124-046 adds a private local telemetry history rather than converting past log output into fictitious historical commits; old logs/data remain untouched. A124-045/047 enforce finite transport admission without changing existing stored schemas or valid message formats.

A124-050 adds after-state recovery journals to the existing environment migrations; legacy backups without a matching journal are preserved and require manual comparison. A124-051 sanitizes rendering without changing saved chat data. A124-052 adds `migrate-local-file-permissions.py` (preview, `--apply`, `--restore`, optional `--path`): owned regular files only, original modes/digests in a private journal, later changes refuse restore. HUD config/testbed/layout writes are private and atomic. A124-053/054/055 change only RPC resource lifecycle, dispatch admission and command construction, with no persisted-data conversion.

## WSL continuation interfaces (056–070)

`setup-pyats-runtime.py --preview` is read-only. Normal setup stages pinned source
and Python3.12 dependencies, verifies imports, atomically adopts a symlink and
retains a previous target; `--restore` restores it while retaining the replacement.
Repeat validates a managed generation; `--rebuild` refuses an existing recovery
point. The installer supplies the managed server path to `migrate-pyats-http.py
--upstream PATH`; that adoption uses `.pre-pyats-managed` independently of the
legacy HTTP migration backup and keeps conflict-detecting restore behavior.

Deployment now preserves persona/testbed/custom-store choices and uses the literal
writer. CLI systemd writes use its explicit `--systemd` codec, validated against a
real EnvironmentFile. Failed required component/token installation exits nonzero.
No data conversion accompanies snapshot redaction, memory error/filter correctness,
budget validation, input limits, role fail-closed behavior, approval expiry or mobile
late-client cleanup. Existing affected snapshots/names require informed review, not
automatic guessed rewriting. Chroma promotion retains/recoverably renames the prior
collection before adopting staging; interruption limits are documented in
[the migration guide](../../../docs/AUDIT124-MIGRATIONS.md).
