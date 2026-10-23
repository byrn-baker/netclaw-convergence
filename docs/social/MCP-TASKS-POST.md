# Adding asynchronous MCP Tasks to pyATS—and across NetClaw

Network automation involves waiting: establishing SSH sessions, collecting command output, learning device state, applying configuration and running tests. Those operations can take seconds or minutes.

The biggest practical impact of MCP Tasks is in **pyATS SSH workflows**. A task-aware client can receive a handle while the server continues the operation, then poll for status and retrieve the result.

```text
Before: Call tool → wait for SSH and execution → receive result

With Tasks: Call tool → receive task ID
                            ↓
                  Work continues on the server
                            ↓
                  Poll task → retrieve result
```

The pyATS implementation covers **22 tools**, including show commands, configuration operations, device health checks, Genie learning and test execution. It has been merged in [pyATS_MCP PR 15](https://github.com/automateyournetwork/pyATS_MCP/pull/15); NetClaw pins that reviewed revision and forwards the protocol metadata through its local bridge.

There is an important distinction: pyATS already ran blocking SSH operations in worker threads. That protected its event loop, but the original MCP request still waited for completion. Tasks add a separate execution lifecycle that the client can observe after the first request returns.

| Area | pyATS with Tasks |
| --- | --- |
| Initial response | Returns a task handle before execution finishes. |
| Client workflow | Can track pending work and continue other activity. |
| Result retrieval | Subsequent requests retrieve task state and results. |
| Result retention | SQLite retains completed results across restarts. |
| Workload control | Explicit limits bound simultaneous long-running calls. |
| Shared SSH sessions | Calls targeting the same device are serialized. |

Cancellation respects the reality of network operations. Queued pyATS tasks can be cancelled. Once an operation starts, it finishes and retains its result: cancelling a Python coroutine cannot reliably stop an SSH command or undo a configuration change already sent to a router.

On restart, unfinished pyATS tasks fail with an unknown-outcome message. They are not automatically replayed. Existing approval, baseline and verification requirements still apply.

## Applying the same interaction across NetClaw

This work extends beyond pyATS. The coordinated NetClaw 1.5.0 work enables **298 tools across 35 integrations**:

- **22 pyATS tools** using its persistent task runtime.
- **242 tools across 30 owned MCP servers** using FastMCP's Tasks extension.
- **34 tools across four reviewed external servers**: NetBox, Cisco SD-WAN, NVD CVE and Wikipedia.

That is separate from the framework upgrade, which covers **all 35 owned FastMCP servers**. Task support is enabled selectively, tool by tool.

The other areas with particular impact are multivendor SSH and fleet reads; ANTA validation; Batfish and Suzieq analysis; Auvik, Azure, Catalyst Center and Fortinet queries; gNMI reads; packet analysis; and Nautobot/NetBox source-of-truth work. These are operations where the client benefits from tracking work independently of the initial call.

The storage guarantees differ. The FastMCP integrations use an ephemeral memory backend by default, with optional Redis configuration. They do **not** inherit pyATS's SQLite persistence or its finish-and-retain cancellation policy. Cancelling a FastMCP task also cannot guarantee that an already-running worker thread stops.

Existing clients remain compatible: clients that do not advertise the current Tasks extension receive ordinary results. A task-aware client is required to use handles and polling.

## What has been tested

The pinned pyATS implementation passes **137 tests**, covering the real MCP SDK and HTTP transport with simulated device I/O. NetClaw adds focused lifecycle, caller-isolation, cancellation, fallback and thread-responsiveness tests, plus catalog checks for every owned server and the four external task integrations.

There is no measured live-network speedup claim. The demonstrated improvement is in responsiveness, result retrieval and execution control. Live-network and durable-backend acceptance remain separate steps.

The protocol is the current [`io.modelcontextprotocol/tasks` extension](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks). The Python SDK's removed experimental runtime is not the implementation used here: pyATS provides its reviewed runtime, while the other eligible servers use the maintained FastMCP Tasks package.

[Implementation and operational details](https://github.com/automateyournetwork/netclaw/blob/main/docs/MCP-TASKS.md)

[NetClaw implementation PR](https://github.com/automateyournetwork/netclaw/pull/283) · [NetClaw 1.5.0 release](https://github.com/automateyournetwork/netclaw/releases/tag/v1.5.0)
