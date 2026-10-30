# Plan: pfSense MCP integration

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Existing design

Retain [design.md](design.md) as the detailed client/tool/formatter architecture
and [tasks.md](tasks.md) as the implementation sequence. The original requirements
mention XML-RPC or REST, while the design narrows the intended implementation to
REST API v2; a future implementation must confirm that compatibility explicitly.

## Execution boundary

First establish which source repository supplies the current pfSense integration
and map its tool schemas to the original requirements. Then qualify configuration,
authentication, timeout/error handling and read-only responses in isolated fixtures.
Any mutation qualification requires an authorized disposable firewall and baseline.

The absent local package and unchecked original tasks prevent a completion claim.
This repair adds the Spec Kit entry point without creating a duplicate server or
turning the old task list into an instruction to modify the live firewall.
