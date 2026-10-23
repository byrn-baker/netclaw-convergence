# Research: Workspace Files and Claw Controls

See [workspace research](research-workspace.md), [lifecycle research](research-lifecycle.md) and [preview research](research-preview.md).

## Decisions

- Native host control independent of HUD, with explicit persistent binding. HTTP-only control cannot restart a stopped HUD; terminal staging does not satisfy the owner request.
- Authoritative runtime workspace resolution. OpenClaw uses native selected-agent inspection (custom config, env and profile matter); Hermes uses its home. The generic descriptor workspace path is not sufficient evidence.
- Preserve protected Hermes context policy. Its engine disables ordinary persona inputs; managing stored files does not weaken policy or promise prompt activation.
- Six bounded Markdown files with source rendering, explicit review, backups and verified writes. No general filesystem API or deletion.
- Use exact verified supervisor units/owned process trees. Native OpenClaw stop/restart has broader port cleanup and is not a safe substitute for installation-bound service control. Legacy/unowned processes are not adopted automatically.
- Keep dirty content in memory, including through theme/navigation changes; no per-keystroke host messages. Upload source bytes remain exact; edited newline style is explicit.
- Concurrency: manager serialization and last-moment baseline/inode checks catch observed stale changes; standard filesystems offer no universal conditional rename against non-cooperating external writers. Explain coordination in review, refuse observed drift and retain recovery evidence.
- Native VS Code normal-profile observer tests are required to exercise real modal reviews. Source-development preview uses isolated user-data/extensions/runtime homes and real owned fixture processes, never the owner's running services.

No unresolved architecture choice requires owner input. Capability probing and strict refusal handle unknown installed service definitions. Platform support claims depend on recorded acceptance, not source inspection.
