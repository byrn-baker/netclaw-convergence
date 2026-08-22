# Tasks — Spec 118: iN2N Ollama Cloud Members

## Task 1: Fix `in2n-profiles.py` MCP_SERVERS mappings

The `pyats`, `cml`, `nautobot`, and `github` profiles have empty or wrong MCP
server lists. Fix them so `in2n-member-home.py` scopes the right servers:

- `pyats` → `["pyats-mcp"]`  (was `[]`)
- `cml` → `["cml-mcp"]`  (was `[]`)
- `nautobot` → `["nautobot-mcp"]`  (was `[]`)
- `github` → `["github-mcp"]`  (was `["gitlab-mcp"]`)
- `network-guardian` → remove `ollama-mcp` from the list
- `guardian-claw` → same (alias)

## Task 2: Provision all 8 member homes

Run `in2n-member-home.py` for each member with Ollama Cloud model override:

```bash
python3 scripts/in2n-member-home.py --risk byrns-risk --member pyats --model nemotron-3-super:cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member nautobot --model nemotron-3-nano:30b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member network-guardian --model qwen3.5:27b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member cml --model qwen3.5:27b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member suzieq --model nemotron-3-nano:30b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member batfish --model nemotron-3-nano:30b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member viz --model gemma4:31b-cloud
python3 scripts/in2n-member-home.py --risk byrns-risk --member github --model nemotron-3-nano:30b-cloud
```

The `network-guardian` member home already exists (`~/.openclaw-byrns-risk-guardian-claw`).
Overwrite its `openclaw.json` with the new model and without `ollama-mcp`.

## Task 3: Remove `ollama-mcp` from Border config

Edit `~/.openclaw/openclaw.json` (the live Border config) and remove the
`ollama-mcp` entry from `mcp.servers`. Also remove from `config/openclaw.json`
(repo template).

## Task 4: Clean up `.env`

- Remove `NETCLAW_MODEL_CODER=devstral-2:123b` (retired model, ollama-mcp is gone)
- Remove `NETCLAW_MODEL_FAST=deepseek-v4-flash:cloud` (same reason)
- Remove `NETCLAW_MODEL=gemma4:31b-cloud` and `NETCLAW_MODEL=claude-sonnet-5`
  (duplicate/conflicting entries — Border model is `NETCLAW_BRAIN_MODEL`)
- Keep `OLLAMA_API_KEY` and `OLLAMA_BASE_URL` (members need them)

## Task 5: Generate and enable systemd services

```bash
python3 scripts/in2n-services.py generate
python3 scripts/in2n-services.py enable
python3 scripts/in2n-services.py status
```

## Task 6: Verify

- `netclaw risk status` or `curl http://127.0.0.1:8179/n2n/status`
- Verify all 8 members show as enrolled
- Test a delegation: ask the Border something pyATS-specific and confirm it
  routes to the pyats member on `nemotron-3-super:cloud`
