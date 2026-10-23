# Spec 142 — Protocol-native asynchronous MCP Tasks

Status: ratified for implementation by the owner's 2026-10-05 request to add Tasks to as many MCPs as possible before publishing the release.
Branch: `feat/mcp-async-tasks`, based on the unmerged spec 141 migration.

## User stories

1. An operator submits a slow eligible read or analysis and immediately receives a standard MCP task handle. The client polls until the original result is available, while other requests remain responsive.
2. A legacy or non-task-aware client receives the same foreground result and tool schema as before.
3. An operator can request cancellation, distinguish tool errors from protocol failures, and understand task retention and recovery limits.
4. A maintainer can inspect per-tool eligibility and verify broad coverage without granting new write, credential or approval authority.

## Requirements

- FR-001: Implement the 2026-07-28 `io.modelcontextprotocol/tasks` extension through the maintained FastMCP Tasks runtime; do not reimplement JSON-RPC or revive removed SDK1 task APIs.
- FR-002: Return handles only to clients declaring the extension on that request. Support tasks/get, tasks/update and tasks/cancel with standard capability, routing and error semantics.
- FR-003: Inventory every owned FastMCP server and the reviewed external fleet. Explicitly enable eligible tools; record exclusions. Prefer slow reads, bounded analyses and SSH reads. Leave mutations, approvals, streaming collectors, already-asynchronous job submission and caller-context-unsafe paths foreground.
- FR-004: Preserve public names, descriptions, arguments, original results and direct Python function behavior. Offload eligible blocking functions without blocking the event loop.
- FR-005: Preserve existing execution-time policies, authentication, audit and read-only restrictions. Bind HTTP task access to the authenticated caller or exclude that integration until binding is verified. No new listeners or vendor calls during tests.
- FR-006: Isolate queues by server identity and bound embedded worker concurrency. Document memory-backend loss on restart, durable-backend configuration, sensitive stored arguments/context and cooperative cancellation of threads.
- FR-007: Pin the extension package alongside FastMCP and SDK versions. Update installers, contract environments and documentation together. No change to unsupported external SDK1 backends.
- FR-008: Exercise real wire handles, polling, completion, cancellation, task error semantics, unsupported clients, malformed/unknown IDs, HTTP routing and caller isolation. Use fixture execution, not schema-only assertions.
- FR-009: Add adoption inventory and regression enforcement. Preserve spec 141 exceptions rather than counting them as new successful migrations.
- FR-010: Update the release writeup, notes, PR and release acceptance before the authorized commit/push/merge/tag workflow resumes. No release while applicable checks fail.

## Success criteria

- SC-001: Every candidate has an explicit eligibility disposition; all enabled tools use a tested runtime and unchanged input contracts.
- SC-002: A gated fixture proves the task handle returns before work is released, polling progresses and the final result matches foreground execution.
- SC-003: Legacy and modern non-declaring requests continue to complete without handles; task-aware requests use the extension.
- SC-004: Denial and authentication tests pass; no live vendor operation or production runtime deployment is implied.

## Scope and assumptions

This is an additive capability on top of spec 141. Optional task execution is enabled only on reviewed tools, not globally. Existing tool authorization remains the authority to execute; returning a handle is not approval. Local memory queues are single-process and ephemeral. Durable Redis operation needs explicit configuration and separate operational acceptance. As many as possible means every eligible integration supported by available source and verifiable dependencies, with concrete reasons for exclusions.
