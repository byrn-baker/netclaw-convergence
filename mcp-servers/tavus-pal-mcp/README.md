# NetClaw Pal MCP facade

Local stdio server, FastMCP 4 / MCP 2, one tool: `pal_query(question, session_id)`.
The HUD owns authentication, usage and audit, then calls this facade. It forwards
a bounded question to the fixed `netclaw-pal` OpenClaw agent over authenticated
loopback HTTP. It never selects an arbitrary endpoint, agent, model or device.

The agent must have `tools.deny: ["*"]` and the dedicated reviewed workspace.
The facade checks those on every call. Shell, device, memory, delegation and MCP
tools are unavailable to that agent. Returned model text is `local_only`; the HUD
speaks a fixed completion notice until the operator approves the exact answer.
Provider API keys are not needed in this process. `OPENCLAW_HOME` selects the local
runtime directory; it is operator configuration, never a tool argument.

Install through the optional `tavus-pal` component. Python dependencies are isolated
in `.venv`; the HUD calls it directly. It is deliberately not registered in the
main agent's MCP fleet, preventing recursive main-agent delegation. Device reads
and operational memory are a future phase, not a capability of this first slice.

See [setup and limits](../../docs/TAVUS-PAL.md). Model usage follows the operator's
existing model provider pricing; Tavus Free does not pay for NetClaw's model.
