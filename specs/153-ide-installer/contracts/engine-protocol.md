# Setup engine protocol 1

Entry: `scripts/setup-engine.py`; Python >=3.10, stdlib only. `config/setup-engine.json` declares protocol `{major:1,minor:0}`, plan schema 1, catalog version 1, Python minimum and fixed entry point. Bootstrap reads and validates this file without executing source. Unknown major/schema or source mismatch refuses execution.

## Commands

| Operation | Inputs | Effects/output |
| --- | --- | --- |
| validate | plan file; selected checkout catalog | Strict parsing/schema/semantic diagnostics, canonical hash; read-only. Draft unresolved choices are shown; apply eligibility false. |
| explain | same | Ordered fixed effect IDs, downloads, host/global effects, native steps, selected credentials by key only, controls, cost/external verification choices and cleanup limits; read-only. |
| apply | exact plan; trusted state-root binding; frontend ownership | Native/TTY review, target/source/control checks under locks, secret prompts, journaled effect execution. No `--yes`/plan approval field. |
| resume | run ID + exact plan | Explicit review if authorization expired/changed, observe unresolved effects, revalidate controls/targets; never blind replay. |
| status | run ID | Redacted typed state; no raw paths/errors/secrets in assistant projection. |
| verify | owned run/installation + tier choices | Read-only local tiers by default; bounded live tiers require consent and per-message review. Writes private sanitized verification evidence. |
| export | run ID + user-selected destination | Default structural redaction. Detailed local export requires separate native/TTY review. No network send. |
| cleanup-preview / cleanup | run ID | Preview hashes exact owned resources/revisions. Separate human review; reobserve before each removal. Changed/shared/unknown artifacts preserved. |

CLI dispatcher options: `--emit-plan <file>` creates an interactive canonical draft, `--validate-plan <file>`, `--explain-plan <file>`, `--plan <file>` applies through this engine. Historical flags/outputs remain byte-compatible when no new option is present. No side-effectful legacy `define_paths`/prerequisite phase runs before new-option dispatch.

## Event/input envelopes

Stdout is UTF-8 JSON Lines only, max 64 KiB/event. Common event keys: `protocol`, `runId`, monotonically increasing `sequence`, `type`, `phase`, `owner`, `state`, `code`, optional typed `data`. Types: `hello`, `phase`, `progress`, `needs-input`, `secret-request`, `outcome`, `log-ref`. Errors identify safe pointers/codes, never submitted values or raw child output. Logs are typed sanitized records; unknown raw stdout/stderr is not persisted.

Stdin frames: max 64 KiB, strict UTF-8/JSON, no duplicate/unknown fields. Common `protocol`, `runId`, `requestId`, `type`. `answer` carries a declared non-secret choice; `secret` additionally binds `owner`, catalog `key` and a single-line value; `pause` requests checkpoint pause; `heartbeat` proves only editor liveness. Only a live outstanding request can accept a frame; wrong/expired/duplicate/out-of-order frames fail without echo. Native review responses use a separate inherited trusted UI channel/session capability, never a broker operation exposed to assistants. Terminal interactive flows use the controlling terminal and verify postconditions afterward.

Native apply requires a private inherited channel established by the extension host; command-line flags or a writable “approved” file cannot create authority. The engine's public CLI prompts on a controlling TTY. This boundary cannot prevent a same-user general terminal agent from scripting arbitrary programs; documentation states that client permissions govern such activity. It does prevent the provisioning tool API from applying or obtaining an approval capability.

## Transactions, source and locks

State root and every existing ancestor must be owned, real directories with appropriate permissions; refuse symlinks, foreign ownership, overlapping homes, nonempty new targets and source/home aliases. Use `fcntl.flock` on deterministic canonical resource keys, nonblocking, 0600 lock files in 0700 directories. Lock all homes/source/host resources in sorted order. PID is diagnostic, not the mutex. Hold locks through active writer settlement; descendants receive lock ownership or the parent supervises until exit. A parent crash with a surviving child cannot authorize a concurrent writer.

Journal intent before effects, fsync file and directory, then inspect outcome and journal ownership/revisions. Preserve authoritative state outside homes; no raw secrets. Atomic replacement uses same-directory temporary files and guarded parents. Every adapter implements observe/apply/verify and declares whether owned partial repair is possible. Global prerequisites/native steps are separately reviewed; shared installed runtime binaries/source never update implicitly. Secret subprocess environments are explicitly scoped; source `.env` and neighboring auth are not imported.

On stdin EOF/heartbeat timeout, set pause_requested immediately and never start a new phase. Settled checkpoint yields paused; ambiguity yields unknown. Do not terminate already installed services. Resume is user-started, revalidates the entire binding and inspects all unresolved outcomes. Unknown network/provider/service effects remain unknown until an authoritative probe resolves them.

## Exit codes and fixture seam

0: requested read operation or settled execution returned its report (check report states); 2: invalid/incompatible plan; 3: review/cancel refusal; 4: paused; 5: failed postcondition; 6: unknown outcome; 7: resource/ownership conflict; 8: configuration required. Nonzero cannot become success because a listener exists. Each frontend renders the same outcomes.

Unit/integration tests inject an in-process effect runner and fixture observation layer. Production plan schema has no fixture/test bypass, custom command, environment injection or “assume verified” option. Controlled real-runtime acceptance uses isolated hosts/roots and the same production engine.


## Mandatory semantic policies

- Tiers 1, 2 and 3 are always required. Optional tiers 4–6 record intent in the plan, but `costConsent`/channel test fields are not execution approval. The native session obtains bounded-turn consent and separate per-message destination/content review; assistant-supplied booleans cannot authorize calls. Network tier binds a selected inventory identity and a fixed read-only show operation; no generic command input.
- `config/components/security-policy.json` defines the minimum controls per host/harness/role. Production checks the union of these and explicitly requested controls. An empty requested list cannot disable required controls. Control observations are made by fixed installed-version adapters and remain unverified on unsupported versions. Hermes production guard refusal is preserved until qualified.
- Settings references with source `existing` mean a secret already in **this run's owned** runtime env during resume, with revision/ownership verification. They never permit reading a neighboring runtime or arbitrary path. Cross-claw reuse requires an explicit human selection and separate scoped references; default is independent input.
- Plans are <=1 MiB, nesting <=32, bounded schema lengths/counts and integer-only canonical JSON. Catalog metadata is <=16 MiB. No remote schema refs, executable metadata or script expressions. Conditional requirements use a documented declarative operator vocabulary (`all`, `any`, `equals`, `present`) rather than eval.
- Incomplete drafts may be inspected/saved with missing-field diagnostics under the same closed field definitions. They are not schema-valid Claw Plans and cannot be reviewed/applied. Never fill missing choices with fabricated IDs/commits solely to pass schema. `unresolved` records decisions, not a validation bypass.
- Source acquisition disables hooks, credential helpers, external filters and protocol/config rewriting; source files, including protocol/catalog data, are read with size/type/ancestor guards. Unknown shared-source ownership means a separate destination is required for any mutable phase.


## Bounded large documents and artifact indexes

Responses larger than one frame use `document-start` (`protocol`, `id`, `bytes`, `sha256`), ordered `document-part` (`protocol`, `id`, zero-based `index`, base64 `data`) and `document-end` (`protocol`, `id`). Raw chunks are at most 32 KiB; total decoded document size is at most 8 MiB. No interleaving, replay, missing part, length mismatch or digest mismatch is accepted. Progress and secret/native-input messages retain the 64 KiB frame limit.

Each journal remains at most 16 MiB. Per-effect artifact indexes are immutable content-addressed private JSON (at most 8 MiB/20,000 artifacts each); an index is fsynced before publishing its `{sha256,count}` journal reference. Hydration verifies its digest/count with a 128 MiB total bound. Read-only status/report projections do not hydrate artifact contents. Unknown or changed indexes refuse recovery.

Seven endpoint keys are mandatory and collision-checked: gateway, HUD API, HUD UI, Hermes companion, iN2N, BGP API and BGP listener. The last two prevent same-host federation clashes. New same-host Risk listeners bind loopback; this does not alter legacy listener defaults.

## Native verification inputs and owned services

The inherited private socket additionally carries `native-choice`/`native-choice-answer` and `native-destination`/`native-destination-answer`. Every answer binds the outstanding random request ID and exact plan hash; destination frames carry only a single validated channel destination. These values never enter progress, plans, reports or assistant tools. The subsequent separate review binds the exact destination and message. Missing delivery receipts and unsettled provider calls stop later verification as unknown. EOF, explicit pause and heartbeat loss close the native socket to wake pending prompts immediately.

`advise --advisor-answers` accepts only the five bounded domains/credentials/production/cost/growth enums. Answers affect estimates and reasons, never the plan, posture, credentials or authority. Tool-context tokens remain unknown until actual schema discovery.

An installed service has a private `service-source.json` index (<=8 MiB/20,000 files) bound by SHA-256 and count in `services.json`. Every indexed file must still match its final run-owned revision before launch/observation and editor lifecycle actions. Environment/config content remains separately managed. This index does not certify all downloaded dependency trees. On-demand refers to the member worker; HUD/gateway management services stay hot. The fixed wake helper verifies ownership/source/native definition, starts the owned native unit without killing an existing worker, and lets Border await authenticated readiness. Member readiness is a private, identity/PID/time-bound file; no extra listener or model call is introduced.

Cleanup consumes the one-use native review before recording an abandonment intent. It then shares each installation’s Spec152 management mutation lock and rechecks the preview. Owned controllers stop in federation/HUD/gateway order; original PIDs must exit and reviewed endpoints must be free. Exact journaled service enable links and definitions are removed before runtime files. Unknown manager state, unjournaled/changed links or unsettled management preserves the affected resources. Interrupted cleanup locks cannot be reclaimed by ordinary editor reconciliation; fresh setup review plus engine writer locks and a dead owner are required. Current readiness is invalidated at cleanup start; the prior report remains private audit evidence. Per-item results distinguish removed, retained and already absent. Preview limit: 20,000 items and 7 MiB; no truncation or recursive removal.

WSL setup-owned lifecycle reads exact loaded argv and flags via fixed `GetUnit`/`ExecStartEx` busctl JSON queries (64 KiB output bound). It never splits a display string, invokes a shell or loads/activates a unit to inspect it. New definitions disable environment expansion and escape percent specifiers. Unknown bus output, foreign object IDs and changed flags refuse lifecycle actions; older definitions containing dollar expansion candidates require reviewed regeneration.

File-phase recovery is explicit: home, selected skills and identity compare the entire deterministic output set and private-directory requirements. Missing outputs in an interrupted owned phase may be repaired after fresh review; completed private outputs are not rewritten. Identical unowned files and changed or previously verified missing outputs are conflicts. A matching prefix of inventory/registration artifacts is not a completed phase and remains unknown.

Runtime effects persist `runtimeStage: source` before copying, then `runtimeStage: dependencies` before any package manager may run. Only the source stage permits exact deterministic copy repair; the dependency stage requires independent runtime/HUD postconditions and never infers replay permission from source files. Existing journals without a stage retain conservative observation. These internal fields grant no frontend/assistant authority.

The local canary has a fixed component/tool/argument mapping. It uses an owned component interpreter, strips credentials and script overrides, and disables dotenv loading. Subnet calculation and ANTA catalog inspection contact no device/provider; member N2N status must match the installation identity and fresh owned health. Other selections remain unverified. Python MCP 2.3 result objects use `is_error` and `structured_content`; transport JSON field naming is not assumed to be the Python API.


## Engine-owned native terminal

A trusted adapter may call the session terminal with a fixed argument vector and selected-home environment. No plan, broker tool or terminal input frame supplies an executable. The private channel carries native-terminal/ready/input/resize/output/exit frames bound to a random request ID, plan hash, selected owner and declared onboarding/component effect. The editor uses a transient VS Code Pseudoterminal. Raw terminal bytes stay in that private channel and local display, never progress, reports, journals or assistant responses. Inputs are at most 16KiB, frames 64KiB, output 8MiB and execution 30 minutes.

The engine creates the controlling PTY in a fresh child, records its PID/group and passes writer locks through exec. No threaded preexec hook or shell command interpolation is used. Cancellation, owner loss, invalid frames, deadlines and surviving descendants yield unknown, with no later effect. Closing a terminal never establishes an adapter postcondition; the trusted adapter must verify selected configuration afterward. CLI uses the same owned PTY through its controlling terminal. This transport does not qualify the two deferred native component installers or permit calling their legacy global routines.
