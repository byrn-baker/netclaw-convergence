# Spec 142 verification — 2026-10-05

## Scope and reproducible evidence

- 35 owned servers / 450 tools inventoried; 30 servers / 242 tools explicitly task-enabled. Five owned exclusions and each tool's decision are in `config/mcp-task-tools.json`.
- `owned-catalogs.json`: every owned server passes real client catalog discovery in both protocol modes. `python3 scripts/check-mcp-tasks.py --catalogs specs/142-mcp-async-tasks/owned-catalogs.json` passes registration coverage and structural contract parity with spec 141. Only descriptive metadata is normalized; optional docstring parsing changed Zabbix descriptions without changing its source or structural contract.
- `external-catalogs.json`: Wikipedia 13, NVD 2, SD-WAN 15 and NetBox 4 task registrations pass. SD-WAN's configuration-file generator remains foreground. These probes do not invoke vendor tools. Reviewed commits are in `external-adoption.json`; the remaining external dispositions are in `external-disposition.json`.
- pyATS upstream PR 15 merged at `f11b02f06e0561392603cdd147d28f82373b5470`: independently tested from a disposable clone. 22 task tools; **137 tests pass** against SDK 2.3.0, simulated device I/O and real HTTP transport. The dedicated `pyats-tasks` CI suite clones that exact pin and repeats the upstream fixtures without installing device SDKs.
- Total: **298 tools across 35 task-capable integrations**. This is distinct from the 35 owned servers in the framework migration.
- `dependency-resolution.json`: all 34 new extension manifests/fallback dependency sets resolve for Python 3.12 with uv. Resolution is not live acceptance or every-platform compatibility.

`patch-verification.json` records eight successful pristine-source/previously-patched upgrade scenarios across the four external components, including idempotent second application. Operator clones were read only.

## Executed checks

`python3 scripts/run-contract-tests.py --suite <name> --prepare`:

| Suite | Result |
| --- | --- |
| mcp-tasks | PASS, 7 focused tests |
| pyats-tasks | PASS, 137 upstream tests |
| fastmcp | PASS |
| first-party-mcp | PASS |
| unit | PASS, final full run |
| auvik-mcp, halo-mcp, bgp-intel, catc | PASS offline |
| analysis, anta, cisco-psirt, document, fortinet | PASS offline |
| nsm, redfish, multivendor, n2n | PASS offline |
| installer | PASS with Python 3.12 on PATH |

The focused tests exercise early handles before gated work completes; polling/result retention within runtime; HTTP caller isolation (including identical OAuth client IDs with different subjects); missing capabilities; bad task IDs/routing; tool-error completion; cancellation; elicitation/update; ordinary foreground compatibility; actual multivendor thread responsiveness; and policy denial before credentials/network access. They use real SDK/extension dispatch and mocked device operations.

The pyATS bridge/recovery targeted tests pass (15 tests). Release-helper tests pass (6). Spec artifact verification and all six repository reconciliation surfaces pass. The final full unit suite also passes; remote CI evidence is recorded in the release PR before merge.

Initial harness failures were corrected: pyATS test environment needed PyYAML; the document provenance guard matched only an empty decorator and now inspects tool-decorated AST functions. Installer invocation requires the documented Python 3.12 baseline; ambient Python 3.10 correctly fails component requirements.

## Boundaries

No live device/vendor operation, production runtime deployment, Redis failover or measured network speedup is claimed. Optional live credentials and Docker are unavailable locally and reported separately by the harness. Existing framework exclusions remain open. Other external task ports remain foreground pending per-tool execution acceptance; no blanket completion claim is made for them.

FastMCP memory queues are ephemeral, cancellation is cooperative and a running thread may continue after cancellation. pyATS separately persists completed results and finishes started work. See `docs/MCP-TASKS.md` for rollout and recovery details. The social post preserves this distinction.

## Release

PR 282 already merged the framework work into main. Spec 142 is [PR 283](https://github.com/automateyournetwork/netclaw/pull/283), a follow-up on `feat/mcp-async-tasks`; both are coordinated in the still-unpublished 1.5.0 release. Applicable CI must pass before merge and the exact merged main commit must pass before tagging. No published release is claimed by this verification file alone.
