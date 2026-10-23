# NetClaw as a Dot — Sonnet handoff and durable checkpoint

## Start here

**Date:** 2026-09-29. **Git branch:** `134-netclaw-dot`. **Base:** `9c4bce2bd24a353f78737f4b0f7561da9330dabf`.
**Status:** RESUMED 2026-09-30 — Dots now available on owner account. Server + tests built (synthetic mode); Dot connection, exposure and acceptance pending.
**Resume only when the owner requests it.** Then recheck account availability and current official documentation before T003 in [tasks.md](tasks.md). Read this file first after every context reset and update it after each milestone.
This is a build handoff requested by the owner, not a claim that NetClaw is already installed as a Dot.

## Decision

**Conditionally viable:** configure an available Dot to use a bounded NetClaw capability package while NetClaw remains the local execution and policy authority. Do not rewrite OpenClaw or claim a one-click agent conversion. A synthetic proof can be built now; operational viability depends on actual account availability, supported connection behavior and the local data boundary.

The announcement confirms cloud computers, plugins and optional connected computers. Specialist organizational Dots are a separate enterprise pilot. No reviewed source establishes a NetClaw import format, public Dot creation API, selectable Sonnet runtime, or arbitrary background access to a local MCP server. Sonnet is the implementation model for this handoff, not a promised Dot model. See [research.md](research.md) for sources and unresolved evidence.

## Resume prompt (paste into Sonnet)

> Work in `/home/johncapobianco/netclaw` on `134-netclaw-dot`. Read `specs/134-netclaw-dot/HANDOFF.md`, then spec, plan, contracts, tasks and verification. Follow AGENTS.md and the Spec Kit constitution. Complete the next unchecked task, preserving all prior unrelated changes. Use synthetic data first. Never invent Dot SDKs, manifests, account access, approval or live test results. Keep credentials, raw configs and private topology local. Checkpoint task IDs, changed paths, commands/results, blockers and the next exact action in HANDOFF.md after each milestone and before stopping. Carry out independent implementation and verification work while account-dependent tests remain explicitly blocked. Do not deploy, publish, send messages or change devices under this handoff alone.

## Existing state to preserve

At branch creation main had these existing modifications: CHANGELOG.md, README.md, VERSION, benchmarks/gcf_vs_toon_benchmark.py, docs/reference/{CLI-REFERENCE.md,documents.json,hud-openapi.json,interfaces.json}, specs/131-canvas-terminal-workflows/{tasks.md,verification.md}, ui/netclaw-visual/src/security/server-access.test.js, ui/netclaw-visual/test/terminal-smoke.mjs; untracked docs/releases/1.2.0.md and mcp-servers/prisma-sdwan-mcp/. They belong to prior work. No reset, stash, blanket staging or release/version edit. Branches share a working tree; these edits are not isolated by creating a branch.

GAIT branch `132-netclaw-dot-20260929` is separate from Git; runtime root is `~/.openclaw/gait`. Branch and checkout succeeded. Use `scripts/mcp-call.py` with `python3 -u scripts/gait-stdio.py` for GAIT tools; check status each session. MemPalace is unavailable in this tool session; do not claim a diary write. Read daily memory before resuming. Inventory startup was attempted; see verification for result. Do not repair the owner's testbed as a side effect of this feature.

## Architecture and scope

Dot / supported ChatGPT task host → authenticated bounded NetClaw tool facade → existing local read-only MCP tools → local evidence/audit. Only explicitly classified non-sensitive results may cross to the hosted model. Synthetic fixtures are the default until that boundary is proven. A local process does not imply that model-visible output stays local.

Prefer a local supported connection proof first. Imported plugins declaring MCP servers are documented as desktop-only even with HTTPS URLs; do not promise mobile/background Dot access based on a desktop success. If the actual Dot cannot use the local path, record it and assess a registered remote app separately. Do not expose the HUD, native gateway, SSH or a generic MCP proxy to the internet. Remote deployment requires a separate reviewed authentication and disclosure design; this handoff grants none.

MVP: inventory aliases, one bounded health summary and audit status, all read-only. Exclude free-form CLI, configuration, shell, unrestricted files, arbitrary tools, dynamic Python, quarantine, ticket creation and messaging. This avoids depending on prompts to restrain a powerful generic gateway. Preserve existing platform routing and DefenseClaw/OpenShell controls. Cloud auto-review complements, but never substitutes for, NetClaw change control.

## Build sequence and files

1. T003: record account/client versions and a synthetic Dot tool call, including whether it runs locally, remotely, in Work/Codex delegation, and with desktop offline. Do not treat these modes as interchangeable.
2. Ratify the concrete MVP spec per repository constitution before runtime implementation. This draft does not self-ratify. Continue fixture design and documentation while ratification/account proof is pending.
3. Add proposed `mcp-servers/netclaw-dot-mcp/` with isolated dependencies, three typed tools from [contracts/tools.md](contracts/tools.md), bounded adapters, redaction before response and durable local audit. Discover installed backend schemas; never hardcode guessed names/arguments. Use existing pyATS inventory and validated read paths where available.
4. Add synthetic unit/contract tests under proposed `tests/dot/`; no device credentials or live services in CI.
5. Author a small proposed `plugins/netclaw-dot/` package after fetching current official packaging schema. Use the skill-creator instructions when creating actual skills. Begin with one triage workflow; do not copy all of SOUL, TOOLS or the entire skill library into hosted instructions.
6. Test supported desktop installation. Then independently test the actual Dot surface. Keep a per-surface matrix, with unsupported routes explicit. A successful ordinary ChatGPT tool call is insufficient for Dot acceptance.
7. Complete operator documentation and review evidence. Register/install/count a server only when actually shipped; follow constitution artifact coherence then. Leave release metadata unchanged in this planning branch.

## Validation and completion

[verification.md](verification.md) contains the acceptance matrix. Required negatives include unauthorized identity, out-of-scope alias, arbitrary CLI injection, private data in errors, stale evidence, backend timeout, audit failure and attempted write. Use fake adapters and synthetic secrets. Enforce limits in code, not only tool annotations. Verify revoke/disconnect prevents future access; it cannot undo a completed read. No device rollback is needed for a read-only MVP. Disable/uninstall the adapter/plugin while preserving evidence to roll back deployment.

Definition of done: ratified spec, passing contract/security tests, real account Dot proof, local data-boundary proof, supported installation/revocation guide and complete audit. Until then label the package experimental and list the precise missing gate. Never report production-ready solely from unit tests.

## Progress ledger

| Checkpoint | Result | Next action |
|---|---|---|
| C0 — 2026-09-29 | Official sources reviewed; integration conditionally viable; specialist pilot distinguished | Prove chosen host/account path |
| C1 — 2026-09-29 | Git and GAIT branches created; previous changes preserved | Keep work scoped |
| C2 — 2026-09-29 | SDD spec/plan/tasks/research/contracts/data model, usage and handoff written | T003 capability probe |

Append checkpoints using: date; task IDs; files changed; exact test command + outcome; unresolved blocker; next task. Update status at top. Never mark live tests passed using fixtures.

## Owner follow-up: real access, proof and recording

The owner asks what the Dot looks like and what credentials/setup enable a real recorded proof. A Dot named NetClaw would accept a bounded triage request, use the approved connection, return timestamped findings and reference local audit. It cannot be claimed operational yet.

Required inputs, supplied through supported settings rather than chat:
1. A Dot-enabled ChatGPT account/workspace and any required admin enablement. A Platform API key alone does not create or unlock a Dot; no reviewed documentation establishes a separate Dot API key.
2. An actual supported host connection or approved app/plugin route, authenticated as the owner with the narrowest read scope. Discover the real setup mechanism in the account; do not guess OAuth IDs or issue tokens without a selected transport. Keep existing device credentials in NetClaw's local secret store.
3. A working local inventory/backend and one explicitly authorized read-only target/check. Current `pyats_list_devices` fails on testbed `connections.defaults.arguments` unsupported keys. Diagnose separately with owner scope; do not overwrite the testbed. Do not display target identity or testbed content in a public demo.
4. A reviewed output policy. Current AGENTS.md keeps private configuration/topology local. Use an owner-designated non-sensitive demo device/summary. Any proposal needing private hosted disclosure is blocked under current policy; local execution alone is insufficient.
5. Recording destination and audience: a local private screen recording by default; decide whether the owner wants video, audit transcript or both. A target-app recorder is not available/proven in this session. Never promise automatic screen capture without checking host support and obtaining scope for captured windows.

Demo runbook after implementation: start local GAIT session → show connected tool/profile with secrets masked → issue one actual Dot inventory/health request → correlate request ID, timestamp and backend observation with local audit → demonstrate denied write and revoked access → save sanitized transcript and optional local video → review for private data before any sharing. Keep a separate unredacted local evidence record if needed; a video alone does not prove backend execution. Capture desktop/client version, host online/offline status, actual connection/delegation mode and exact test outcome. No fabricated success footage or substitution of ChatGPT Work for a Dot.

C3 — 2026-09-29: Startup inventory returned schema error at connections.defaults.arguments; no network health result. Owner's real-access/proof/recording requirements added. Next: T003 account/host capability probe, with existing backend error tracked independently.

C4 — 2026-09-29: Owner confirmed Dots unavailable on their plan and explicitly deferred all Dot work. No further implementation, connection setup or account probing. Preserve branch and documents; resume only on owner request. Correction to prior GAIT completion note: validation covered 10 Markdown documents total, not 11.

C5 — 2026-09-30: Owner resumed; Dots available. Docs recheck: Dots call plugins; a personal plugin = MCP server via public HTTPS `/mcp` URL or Secure MCP Tunnel (Developer mode in Settings → Security and login). Built `mcp-servers/netclaw-dot-mcp/{core,server}.py` (3 read tools, bearer auth, audit-first, live mode denied) + `tests/dot/test_dot.py` (14 pass: `python3 -m pytest tests/dot -q`). Local MCP client smoke over streamable HTTP with public Host header passed. Exposure plan: nginx location `/netclaw-dot/` on existing zoom.automateyournetwork.ca vhost (snippet in mcp-servers/netclaw-dot-mcp/nginx-netclaw-dot.conf.snippet; needs owner sudo). ngrok here is TCP-only for mesh — not used. Open: does the Dot plugin UI support bearer auth? T003/T010 not done. No README/catalog/counts/reconcile yet (T011).

C6 — 2026-09-30: Plugin connected to real Dot via OAuth (user-defined client; endpoints under /netclaw-dot on zoom vhost; OAuth in oauth.py, 25 tests pass). netclaw_ask is now async (job_id) + netclaw_job_result; agent replies labelled mode=agent. Live: member johns-risk/pyats returned real R1 interface data in ~minutes (task 880b964a); one earlier task b64e95d9 failed with no error text. pyATS direct read verified. GAIT repo ~/.openclaw/n2n/gait repaired (3 zero-byte objects removed, master reset to last intact commit 03daa594 of 2026-08-12; backup gait.bak-*-dotfix kept). Member cgroup "7 GB" is page cache (anon 23 MB), not a leak. Open: T011 docs/catalog/counts, plugin skill package, (k3s process resolved: it is the OpenShell cluster container openshell-cluster-openshell, required by production members; leave running).

C7 — 2026-10-01: Renumbered 132 → 134 (132 is Equinix, 133 is the installer isolation fix); branch renamed 134-netclaw-dot. Released as NetClaw 1.3.0. The GAIT branch name 132-netclaw-dot-20260929 is historical and unchanged.
