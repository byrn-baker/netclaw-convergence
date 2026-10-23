# Audit data model

- Coverage entry: path (unique repository-relative path), subsystem, ownership (first-party/vendor/generated/asset), review state (pending/reviewed/excluded), methods, evidence references, finding IDs, limitation. Exclusions require reasons; enumerating a file does not mark it reviewed.
- Finding: immutable ID A124-NNN; severity; status suspected/confirmed/fixing/verified/blocked; affected paths; reproduction; impact; requirement and task IDs; remediation and verification references. Verification failure returns the finding to confirmed. A blocked finding is unresolved, never clean.
- Verification: command/procedure, revision/worktree identity, platform/interpreter, input fixture, exit status, result (pass/fail/blocked/not-applicable), evidence path, live/simulated/source-only classification. No secrets in evidence.
- Migration: applicability/versions, source and target state, preflight/preview, backup manifest, execution checkpoint, verification, recovery; states planned/preflight-failed/backed-up/applied/verified/recovery-required/restored. Unsupported state fails before writes.
- Handoff: branch/revision, decisions, completed and remaining tasks, findings, validation matrix, environment requests, next workflow step. Links reference the same stable IDs as findings/tasks.
