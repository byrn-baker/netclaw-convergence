# Management Contracts

## Discovery and binding

A session-authenticated GET `/api/hud/management` identifies only the current installation's runtime home, config, agent, source checkout and applicable native executable/context paths. It has no write action and returns no credentials or file content. Older servers may return 404. Binding requires native owner/path/identity validation and human review before executing the helper. Host context and selected profile are part of every binding.

## Fixed local operations

The helper accepts bounded JSON on stdin and emits one bounded JSON result. Operation names are a closed enum: `inspect`, `read`, `prepare-write`, `apply-write`, `prepare-lifecycle`, `apply-lifecycle`, `reconcile`. No caller-supplied shell or arbitrary path target. `read` and writes accept only SOUL/AGENTS/IDENTITY/USER/TOOLS/HEARTBEAT.md. No delete endpoint or command exists.

Write preparation returns exact target, baseline and draft digests; applying requires the same reviewed inputs. Content is strict UTF-8 up to 1 MiB. Missing files use absence preconditions. Existing files use original recovery and replacement/readback. No file contents in operation journals.

Lifecycle preparation returns the exact in-scope owned services and their fingerprint. Apply accepts only `start`, `stop`, `restart`, with matching review and explicit interruption acknowledgment. It revalidates identity/ownership at every phase and persists stage evidence. Stop uses owning supervisor or recorded process identity, never process-name/port-wide termination. Start verifies readiness and same installation. Full-action capability is unavailable if any required configured component is ambiguous.

## Editor bridge

Control-panel messages carry view ID, monotonic sequence and selection generation. No file content is sent through that webview. The native file-system provider accepts at most 1 MiB of strict UTF-8 and binds each document URI to its installation and selection generation. VS Code owns dirty-close prompts, Undo and local editor backup policy. Dialog and upload returns recheck the current target. No delete or rename implementation is provided. File contents are inert native source text.

Save alone invokes no lifecycle operation. Save and Restart uses one review including interruption scope, saves and verifies, then revalidates the reviewed lifecycle target before applying. Any failed/unknown save prevents restart. Outcomes remain separate. Invalidated views cannot dispatch.

## Verification boundaries

Observe → review → apply → verify. Configuration/readiness does not prove provider/tool execution or prompt consumption. Managed process fixtures are labeled synthetic. Mac qualification does not imply WSL/native Linux/Remote acceptance. Private files and journals never leave selected operator hosts automatically.
