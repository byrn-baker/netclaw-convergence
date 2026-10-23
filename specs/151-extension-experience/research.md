# Research decisions

2026-10-11. Research is complete; no unresolved planning questions.

| Decision | Rationale | Alternatives considered |
|---|---|---|
| Semantic domain presenters and shared adaptive card primitives | CSS alone cannot fix recursive raw-object organization; preserve useful source-specific labels | Microsoft Adaptive Cards adds a schema/runtime without solving domain mapping; retained HTML is accessible and locally bundled |
| Follow VS Code theme and retain blue actions | Owner answers B/A and existing usability preferences | Forced dark and site-pink primary buttons rejected |
| Existing HUD owns testbed edits | Owns active sessions, grants and cached logins; raw API is not safe enough | Extension-local writer or unsafe raw PUT bypass those controls |
| YAML CST plus strict data-only validation | Preserve advanced fields/comments while rejecting ambiguous transforms | Full load/dump on every form edit loses formatting; pyATS loading can execute/follow external references |
| Lossless baseline-bound masking | Existing display scrub cannot round-trip credentials | Full raw secrets or reusable redaction strings are unsafe |
| Fixed CSV subset patches existing inventory | Owner selected practical inventory import, preserving advanced fields | CSV whole-document replacement loses data |
| Presence-only MCP metadata plus scoped revision save | Prevent secret exposure and lost updates; internal comparison proves save | Existing masked prefixes/all-password prompts are insufficient |
| Explicit integration/component joins and bounded setup runner | Catalog IDs differ; full installer and generic restarts have broader effects | Executing arbitrary shell from a card is rejected; unqualified actions remain explicit guidance |
| Pinned local Three.js BGP view plus semantic list | Meets owner's purposeful 3D choice with truthful source links | Invented physical mesh, always-spinning globe, external assets rejected |
| Local generated decorative art | Adds visual identity without rasterizing UI or sending private data | Existing icon alone does not meet selected custom-art direction |

Detailed source evidence, limitations and acceptance requirements: [visual](research-visual.md), [testbed](research-testbed.md), [MCP setup](research-mcp-setup.md).

Reference: [Automate Your Network](https://automateyournetwork.com): strong hierarchy, compact mono labels, magenta/cyan highlights and bordered feature cards. Adapt those traits to the active editor theme; preserve NetClaw branding and blue actions. The HUD testbed may be shared between runtimes and may differ from PYATS_TESTBED_PATH. Saving it never claims synchronization with a running pyATS process.
