# Asynchronous MCP Tasks

NetClaw 1.5.0 coordinates specs 141 and 142. Task-aware clients can request **298 tools across 35 integrations**: 242 tools in 30 owned servers, 34 in four reviewed external servers, and 22 in the pinned upstream pyATS server. The broader framework migration covers all 35 owned FastMCP servers, including five whose tools remain foreground.

## What changes

A declaring client receives a task ID before eligible work finishes. It polls `tasks/get` for status and the final result. The current `io.modelcontextprotocol/tasks` extension uses per-request capability metadata; it is not the removed experimental SDK task API. Legacy clients and modern clients without the extension declaration continue receiving ordinary foreground results.

For FastMCP clients, install the matching `fastmcp-tasks==4.0.11` package and use its helper:

```python
from fastmcp import Client
from fastmcp_tasks import call_tool_task

async with Client(server) as client:
    task = await call_tool_task(client, "eligible_tool", {"argument": "value"})
    result = await task.result()
```

`server` is your existing client transport and tool arguments remain tool-specific. A task-aware workflow can retain the handle and use `task.status()`, `task.wait()` or `task.cancel()` before retrieving the result. The repository's ordinary one-shot `mcp-call.py` workflow remains foreground; installing the server alone does not make a client task-aware.

## pyATS: SSH and persistent results

The isolated runtime pins upstream commit `f11b02f06e0561392603cdd147d28f82373b5470`, merged through [pyATS PR 15](https://github.com/automateyournetwork/pyATS_MCP/pull/15). Its custom Tasks implementation covers 22 tools, including show commands, configuration, health checks, Genie learning and tests. NetClaw's stdio/HTTP bridge forwards modern protocol metadata and method/task routing headers.

Blocking SSH already ran in worker threads. Tasks additionally release the initial MCP request while that work continues. Same-device operations are serialized. SQLite retains completed results across restarts; a process lock prevents sharing that database between simultaneous server processes. Queued tasks can be cancelled; started operations finish and retain their results. Unfinished tasks found after restart fail with an unknown-outcome message. They are not automatically replayed. Task handles never replace configuration approval, baseline capture or post-change verification.

## Other integrations

| Integration group | Where Tasks help |
| --- | --- |
| Multivendor CLI | SSH reads, normalized facts, reachability and fleet reads without waiting on the initial request. |
| ANTA, Batfish, Suzieq | Validation and network-state analysis. |
| Auvik, Azure, Catalyst Center, Fortinet, Claroty | Inventory, operational telemetry and controller queries. |
| gNMI, GNS3, EVE-NG, Redfish | Reviewed reads across devices, labs and hardware management. |
| Nautobot and NetBox | Source-of-truth queries, reconciliation and reviewed rendering. |
| Packet Buddy, Protocol, Analysis, RAG | Capture analysis, protocol reads and bounded local data analysis. |
| NVD, Cisco PSIRT, SD-WAN, Wikipedia | Security references, controller state and reference retrieval. |

The complete owned per-tool decision list is [config/mcp-task-tools.json](../config/mcp-task-tools.json). External registrations and exact reviewed revisions are in [external-adoption.json](../specs/142-mcp-async-tasks/external-adoption.json). External sources are patched through the existing hash-checked installer, not edited in operator clones.

## Storage, cancellation and workload limits

FastMCP uses `TasksExtension` with **one embedded worker per server** and a distinct queue name. Selected blocking reads are offloaded to worker threads; direct Python functions retain their original calling convention. This limit bounds background task execution, not every foreground or vendor-internal fan-out operation.

The default `memory://` backend is ephemeral: process exit loses task state and results. Unlike pyATS, these integrations do not gain SQLite persistence. Optional `FASTMCP_DOCKET_URL` configures a Redis backend. Secure that backend and use `FASTMCP_TASKS_ENCRYPTION_KEY` for task context snapshots. Arguments/results also require protection. Redis persistence is not proof that application-local sessions or files support multiple replicas. Durable queue redelivery is not exactly-once execution; production Redis failover and multi-worker behavior need separate acceptance.

FastMCP cancellation is cooperative. Cancelling a task cannot reliably stop an SSH command or other blocking function already running in a thread, and does not undo side effects. Do not assume a cancelled FastMCP task retains a late thread result. pyATS has its own stronger finish-and-retain policy described above. Treat unknown outcomes as an investigation, not permission to resubmit.

## Foreground exclusions

Owned Dot retains its authenticated job API pending a Tasks principal-binding adapter; N2N retains its grant-bound lifecycle. Jev and Image Style retain their paid/side-effect semantics. Zabbix's vendor surface needs a dedicated adapter. Mutations, approvals, collectors, already asynchronous submission tools and short local responses generally remain foreground. pyATS configuration Tasks rely on its separately tested execution and recovery safeguards.

Other external servers retain their existing foreground behavior because task-specific safety and execution semantics have not been accepted; catalog compatibility alone is insufficient. Atlassian, AWS Cost Explorer, AWS Diagram, PagerDuty and Blender also remain outside the framework port. RADKit validation still needs its licensed client. These are explicit remaining scope, not successful task migrations.

## Validation and rollout

All 35 owned catalogs pass discovery in legacy and modern modes; all 242 enabled tool registrations match the inventory and preserve structural contracts. Four external catalogs verify 34 enabled registrations without vendor invocation. Seven focused tests exercise real SDK/HTTP task lifecycles, caller isolation, cancellation, elicitation, foreground fallback and actual multivendor thread responsiveness/policy denial. The pinned pyATS suite independently passes **137 tests** with simulated device I/O. Existing component regressions and CI supplement those checks; see [verification](../specs/142-mcp-async-tasks/verification.md).

There is no measured live-network speedup claim. Redis failover, every vendor credential path and live device operations have not been validated. Source release publication does not deploy running MCP services. Stage separate source and runtimes, validate the actual client, drain existing work before switching, and preserve matching source/runtime plus any pyATS result database for rollback. Never run two pyATS processes against the same task database.

References: [current Tasks specification](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks), [SDK migration](https://py.sdk.modelcontextprotocol.io/migration/#experimental-tasks-support-removed), [FastMCP Tasks](https://gofastmcp.com/servers/tasks).
