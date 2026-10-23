# Upgrade pyATS to stateless HTTP

NetClaw uses pyATS MCP revision `d4971436328369ef0a581ca5359dc8700fb2939b`,
including native process pCalls. This upstream release requires MCP SDK 2.x and
supports Streamable HTTP rather than direct STDIO. Install its dependencies in a
separate environment so other MCP 1.x integrations keep working.

## Install and migrate

The staged installer defaults to Python 3.12 via uv. Use `PYATS_PYTHON` only to
select another interpreter supported by the pinned pyATS package for your platform.
An unsupported wheel/interpreter fails installation; there is no unbounded package
fallback. macOS and Linux are supported host targets; use Linux inside WSL2 on
Windows. Native Windows is not a full pyATS host.

```bash
./scripts/install.sh --add pyats
python3 scripts/migrate-pyats-http.py --env-file ~/.openclaw/.env \
  --upstream ~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py
python3 scripts/migrate-pyats-http.py --env-file ~/.openclaw/.env \
  --upstream ~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py --apply
```

The installer writes the new runtime variables. The explicit migration command is
for existing/custom environment files: preview first, then apply. It preserves
unrelated settings and `PYATS_TESTBED_PATH`, creates a mode-0600
`.env.pre-pyats-managed` recovery file (preserving earlier `.pre-pyats-http` backups) before changes, and is safe to repeat when
already migrated. Reload the runtime environment after changes. For Hermes,
supply its environment path and `--venv ~/.hermes/pyats-venv`.

The three settings are `PYATS_MCP_SCRIPT` (NetClaw bridge),
`PYATS_UPSTREAM_SCRIPT` (upstream server), and `PYATS_VENV` (dedicated environment).
The bridge expands no shell commands. Prefer absolute paths in environment files.

Existing skill calls keep this form:

```bash
MCP_CALL_TIMEOUT=120 python3 "$MCP_CALL" "python3 -u $PYATS_MCP_SCRIPT" \
  pyats_pcall_show_command \
  '{"device_names":["R1","R2"],"command":"show version"}'
```

Use device names discovered through `pyats_list_devices`. This is a native
`pyats.async_.pcall`, distinct from threaded `pyats_run_show_command_multi`.
Check each device's status and aggregate failure counts.

## Runtime lifecycle

The bridge owns a stateless HTTP server on a temporary loopback port. It forwards
MCP messages without changing tool schemas and stops the server when the client
exits. There is no permanent listener or system service to manage. The environment
and device credentials remain local. HTTP proxies are bypassed for loopback RPC.

Stateless HTTP does not eliminate server caches or snapshot state. A single
bridge session can handle multiple requests, but separate one-shot invocations
have separate process state. Export baselines explicitly; never assume a previous
process's in-memory snapshot still exists. All device configuration changes still
require the baseline, approved change, and verification workflow.

For a persistent HTTP client, run the upstream server with the dedicated venv and
explicit `PYATS_MCP_HTTP_HOST=127.0.0.1`, `PYATS_MCP_TRANSPORT_MODE=stateless`, and
an available `PYATS_MCP_HTTP_PORT`. Its unauthenticated HTTP endpoint must remain
local; use an authenticated tunnel for remote access.

## Recovery

```bash
python3 scripts/migrate-pyats-http.py --env-file ~/.openclaw/.env --restore \
  --upstream ~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py
python3 scripts/migrate-pyats-http.py --env-file ~/.openclaw/.env --restore --apply \
  --upstream ~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py
python3 scripts/setup-pyats-runtime.py --restore
```

Restoring the environment alone does not turn an HTTP-only upstream into a STDIO
server. To return to the old runtime, also restore your recorded previous clone
revision and its compatible isolated Python environment. Keep both until you have
verified the new inventory and read-only commands. Do not reinstall older packages
into the shared environment. The migration does not modify the testbed or devices.

Managed generations retain the previous runtime at `pyats-venv.previous` and
leave legacy source clones intact. See [preservation and recovery details](AUDIT124-MIGRATIONS.md).
