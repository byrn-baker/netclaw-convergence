# Pre-implementation analysis

2026-10-15. Read-only cross-artifact review completed before product changes.

| Finding | Severity | Resolution |
| --- | --- | --- |
| Ordinary file rename cannot guarantee CAS against non-cooperating external writers | Medium | Plan/contracts explicitly require serialization, final inode/digest checks, recovery, observed-race refusal and operator coordination; no universal guarantee claimed. |
| Full Stop removes the ordinary HTTP connection | High, resolved in design | Independent native binding and durable control/journal; retained offline Start path. |
| Hermes persona directory and consumption differ from OpenClaw | High, resolved in design | Native per-runtime discovery and explicit protected-companion non-consumption notice. |
| Legacy process or dynamic wrapper lacks safe ownership proof | High, resolved in design | Capability refusal rather than name/port kill; new owned launch and exact verified supervisor controls. |

Coverage: 31/31 functional requirements and 9/9 buildable success criteria map to the 31 tasks. All five stories have independent tests. No unmapped implementation tasks, unresolved clarification markers or remaining critical/high design findings. Constitution gate passes for operator UI/native management of existing facilities; no new agent integration or authority. Owner has authorized implementation/remediation and isolated acceptance, with live push/deployment held.

Qualification remains evidence-scoped. Native Mac fixture acceptance must not be called live provider or WSL production qualification. Tests that invoke native read-only config discovery may cause the runtime's own config-health metadata updates; no owner runtime is queried during isolated tests.
