# Verification record

**Resumed 2026-09-30.** Evidence below is from the owner's real Dot account; see the live acceptance record at the end. Remaining gate: per-surface support matrix (mobile/offline) not yet exercised.

## Planning session, 2026-09-29
Git branch created from 9c4bce2; prior working-tree changes preserved. GAIT branch/checkout/status and research turn succeeded. Official announcement and four integration documentation pages fetched. SDD/handoff documents authored. No runtime integration created, Dot account inspected, plugin installed, devices configured or external messages sent. MemPalace tools unavailable.

Startup inventory: `python3 scripts/mcp-call.py 'python3 -u scripts/pyats-stdio.py' pyats_list_devices '{}'` returned backend status=error: testbed connections.defaults contains unsupported key arguments. No inventory/device state established. Testbed unchanged.

## Implementation acceptance matrix — all pending

| Evidence | Required result |
|---|---|
| Synthetic tool protocol tests | all schemas/limits/outcomes pass |
| Unauthorized caller/alias and cross-request audit access | denied before backend |
| CLI/tool injection and write requests | no executable path |
| Secret/private topology canaries in success/error/log/artifact paths | no hosted disclosure |
| Backend empty/timeout/stale/partial | accurately distinguished |
| Audit unavailable | fail closed |
| Desktop installation | actual surface/version recorded |
| Actual Dot invocation | synthetic request proves connection; delegation mode explicit |
| Desktop offline/background/mobile | each verified or marked unsupported |
| Live non-sensitive output | reviewed classification, actual provenance, local evidence |
| Revocation | subsequent call denied |
| Regression/coherence | applicable existing tests and documentation checks pass |

Synthetic tests establish implementation properties only. They cannot establish account availability, private network reachability or cloud delivery policy. Record exact commands, versions, dates and sanitized evidence paths for each executed check.


## Live acceptance record, 2026-09-30 → 2026-10-01 (real Dot, OAuth, owner account)

Commands: `python3 -m pytest tests/dot -q` → 25 passed. `python3 scripts/reconcile-mcp.py` → catalog surface passes for netclaw-dot-mcp; the remaining FAIL is the pre-existing `gait-mcp: missing Python module gait_mcp` startup finding, not this feature.

Evidence (sources: `~/.openclaw/dot/audit.jsonl`, `~/.openclaw/dot/jobs/*.json`, nginx `access.log`, member journal; no tokens, addresses or credentials recorded here):
- OpenAI's MCP client (`openai-mcp/1.0.0`) made 215 requests to `/netclaw-dot/mcp`; one `openai-connectors-oauth` POST to `/oauth/token` (the code exchange). Unauthenticated probes returned 401.
- Discovery defects found and fixed from the access log: OIDC probe returned 401 (now 404) and RFC 8414/9728 path-inserted discovery URLs fell through to another vhost (426) until the nginx block was added.
- Audit (46 records): `netclaw_inventory` 4/4 ok, `netclaw_health_summary` 1/1 ok (synthetic), `netclaw_audit_status` 5/5 ok, `netclaw_ask` 11 ok / 2 error (both `timeout_or_pending_approval`, at exactly the then-600 s limit).
- Async job flow: persisted jobs finished ok in 13, 18, 26, 84, 112, 121, 167 and 193 s; two errors at 600 s. A synchronous call previously returned `end ok` ~9 minutes after the Dot's client had abandoned it, which motivated the job_id + `netclaw_job_result` design.
- Live backend proof: pyATS direct `show ip interface brief` on R1 returned live data; the `johns-risk/pyats` member completed task `880b964a…` (2026-09-30 18:10:15 EDT) with a live R1 interface table. One earlier member task failed with no error text.
- Failure mode observed: after a host reboot (2026-10-01 09:09 EDT) the Dot's calls at ~08:08 reported "internal error" while nginx logged nothing, i.e. the host was off. Not an adapter fault.
- Honest gaps: mobile/background/desktop-offline behaviour not tested; revocation test not yet run; live (non-synthetic) health tools remain refused by design; hosted-model disclosure applies to any `netclaw_ask` reply.
