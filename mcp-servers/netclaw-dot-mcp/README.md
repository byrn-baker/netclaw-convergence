# netclaw-dot-mcp

A single-owner MCP facade that lets a **ChatGPT Dot** use NetClaw (spec 134). It is an operator-run
HTTP service, not an agent-registered stdio MCP, so it has no entry in `config/openclaw.json`.

## Tools

| Tool | Purpose |
|---|---|
| `netclaw_inventory`, `netclaw_health_summary`, `netclaw_audit_status` | Read-only, **synthetic fixture** data. Live mode is refused. |
| `netclaw_ask` | Submit a request to the local NetClaw agent; returns a `job_id` immediately. Opt-in. |
| `netclaw_job_result` | Poll a job (long-polls ~20 s). `running` means call again. |

`netclaw_ask` goes through the OpenClaw gateway (`run_agent_turn`), so DefenseClaw, the approval gate and
change control still decide what executes. Replies are labelled `mode: "agent"`.

## Configuration (names only; values live in `~/.openclaw/dot/env`, mode 0600)

`NETCLAW_DOT_TOKEN` (owner passphrase / static bearer, >=24 chars), `NETCLAW_DOT_CLIENT_ID`,
`NETCLAW_DOT_CLIENT_SECRET`, `NETCLAW_DOT_PUBLIC_HOST`, `NETCLAW_DOT_ENABLE_AGENT=1`,
`NETCLAW_DOT_AGENT_TIMEOUT` (seconds), `NETCLAW_DOT_REDIRECTS` (optional exact callback URLs),
`NETCLAW_DOT_PORT` (default 8765), `NETCLAW_DOT_AUDIT` (default `~/.openclaw/dot/audit.jsonl`).

## Run, expose, test

```bash
python3 mcp-servers/netclaw-dot-mcp/server.py        # binds 127.0.0.1:8765; refuses to start without secrets
sudo scripts/dot-nginx-enable.sh                      # adds /netclaw-dot/ + OAuth discovery to the nginx vhost
python3 -m pytest tests/dot -q                        # 25 offline tests
```

Plugin URL: `https://<host>/netclaw-dot/mcp`. Full operator guide: `docs/NETCLAW-DOT.md`.

## Security notes

OAuth 2.1 auth-code + PKCE(S256), passphrase-gated approval, hashed tokens in a 0600 file, constant-time
comparisons, audit-first execution (no audit, no run), at most two concurrent agent jobs, no raw exception
text returned. Anything holding the token can drive the agent: use lab data only and rotate after demos.
