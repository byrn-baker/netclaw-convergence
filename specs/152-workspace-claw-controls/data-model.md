# Data Model

- **ManagementBinding**: schema version, profile ID/host context, installation ID, runtime kind, runtime home/config/agent, source root, Node/native CLI paths, resolved workspace evidence and binding generation. Persist metadata only. Revalidate private identity, config and paths each operation.
- **FileSnapshot**: allowlisted name, state, destination, purpose/loading note, revision or missing sentinel, content when requested, byte count, newline/BOM observations. Content never appears in catalog/audit.
- **WriteReview**: binding revision, filename, baseline revision, draft digest/content, source filename (display only), create/overwrite, backup policy, optional lifecycle review. A change in any input invalidates it.
- **ServiceObservation**: role, owner manager, exact unit/record, running/stopped/unready/unknown/unsupported state, ownership fingerprint, observation time and reason. Never infer stopped from HTTP failure.
- **LifecycleReview**: action, binding, configured owned service list, current scope/config/helper fingerprint, interruption acknowledgment and activity caveat. Only start/stop/restart are accepted.
- **OperationRecord**: random ID, action, target, stage, before/after digests, private recovery references, timestamps and verified/failed/unknown outcome. Write before effect. Unknown blocks another mutation until observation/reconciliation. Content and credentials excluded.

File state transitions: saved/missing → editing → reviewed → applying → verified | failed | unknown | conflict. Lifecycle: observed → reviewed → applying stop/start phases → verified | failed | unknown. Save and Restart links phases but never merges their outcomes or reverts a save automatically.
