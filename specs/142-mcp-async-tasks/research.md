# Research — 2026-10-05

- [Tasks specification](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks): modern per-request extension negotiation, flattened task creation result, polling with inlined final result, update acknowledgements and cooperative cancellation. Tool errors complete with isError; protocol errors fail.
- [SDK migration](https://py.sdk.modelcontextprotocol.io/migration/#experimental-tasks-support-removed): old experimental runtime removed from SDK2. This does not preclude an extension runtime.
- [FastMCP Tasks](https://gofastmcp.com/servers/tasks): supported implementation is the optional fastmcp-tasks package, registered as TasksExtension; eligible functions must be async. Legacy callers retain foreground execution. Memory storage loses work at process exit; Redis can persist it. Stored context can contain credentials, requiring backend access control and snapshot encryption.
- [PyPI metadata](https://pypi.org/pypi/fastmcp-tasks/json), verified now: 4.0.11, Python >=3.10, exact fastmcp-slim[server]==4.0.11, pydocket>=0.26.0. Installed into the disposable contract environment for source inspection.
- Installed extension source provides public registration, task-scoped identity, capability enforcement and HTTP routing-header verification. We will validate those boundaries with real fixtures rather than assuming package presence proves correctness.

No bespoke SDK extension is needed. Prefer explicit upstream registration and per-tool eligibility over a new global dispatch layer. Blocking read wrappers must preserve callable signatures and direct Python behavior; mutation and approval paths stay foreground because replay/cancellation semantics need separate review.
