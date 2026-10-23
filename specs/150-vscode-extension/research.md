# Recovery research

Decision: consume existing HUD presentation endpoints and existing MCP operations.
Rationale: source audit found existing identity, local access, owned conversation,
RAG, configuration and federation interfaces. The former operator facade requires
new backend installation and therefore defeats the requested client boundary.

Decision: run in the VS Code workspace extension host for WSL and Remote SSH.
Rationale: the existing HUD is loopback protected; no new public service or custom
SSH agent forwarding is needed. Browser/webview data goes through the host client.

Decision: bundle an official-SDK stdio MCP adapter with the extension, with fixed
inspect/delegate/propose methods. Rationale: terminal assistants also need access;
registering the whole existing NCFED server would expose administrative approvals.
This adapter is a client surface, not an OS privilege boundary or backend authority.

See scope-recovery.md and contracts/existing-interfaces.md for source findings.
No provider calls or runtime changes were needed for research.
