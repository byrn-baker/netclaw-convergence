# Installer state preservation (spec 124)

External federation now refuses admission when the local role store is unavailable
or has an unknown role. Restore the store from a trusted backup and verify the
intended role before reconnecting. Valid standalone/border/member state is unchanged.
Expired approvals are expired during listing and resolution, even before the task
poller visits them. Start a new invocation to request fresh approval; elapsed
approval records cannot be revived. No stored schema conversion is required.

CLI role persistence now uses private atomic environment writes and decodes quoted
values. Managed mesh values take precedence over fallback dotenv settings. Existing
values are preserved; re-enter a previously corrupted role name through `netclaw
risk role` after checking the intended local role. No automatic name reconstruction
is attempted. systemd EnvironmentFile encoding is verified separately from dotenv.

Budget settings now reject non-finite, negative and malformed limits, retaining
the previous valid layer (or default). Zero remains an immediate ceiling. Boolean
settings accept booleans or the strings `true`/`false`. Correct invalid settings
before relying on a custom budget; warnings name the rejected setting.

Memory semantic search now returns `success: false` on backend/model failure.
Consumers must inspect that field before interpreting results. Date and any-topic
filters work with existing ISO timestamps and comma-separated topic metadata;
no reindex is required. Filtering examines at most 200 nearest candidates. If
the corpus exceeds this bound, `data.partial` is true and the response says more
matches may exist. An empty partial search is not proof of absence. Unfiltered
search keeps its requested top-k behavior.

pyATS now stages its pinned source and a Python 3.12 environment in a separate
generation before replacing `~/.openclaw/pyats-venv`. Package or import failure
leaves the old runtime intact. The installer adopts the verified source through
`PYATS_UPSTREAM_SCRIPT`; the old repository clone is preserved. Existing HTTP
migration backups remain intact; managed-source adoption uses the separate
`.env.pre-pyats-managed` backup and conflict-detecting restore journal.

Preview with `python3 scripts/setup-pyats-runtime.py --preview`. Run the installer
with `--add pyats` to install and migrate together. A repeat verifies the existing
generation; explicit `--rebuild` refuses to overwrite a retained `.previous`
runtime. Inspect and archive that recovery point before requesting another rebuild.
For recovery before subsequent environment edits, restore the environment with
`python3 scripts/migrate-pyats-http.py --restore --apply --upstream
~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py`, then restore the runtime with
`python3 scripts/setup-pyats-runtime.py --restore`. Use matching `--env-file`,
`--venv` and `--target` options for custom paths. Environment recovery refuses
intervening changes; use the private pre-upgrade backup to reconcile those changes
instead of overwriting them. Runtime restoration retains the replaced generation.

Office ingestion applies `RAG_MAX_DOC_MB` to both the compressed file and its
declared expanded ZIP content. `RAG_MAX_DOC_PAGES` also limits workbook sheets,
presentation slides and Visio pages. DOCX does not expose reliable rendered page
counts; its size limit still applies. Existing indexed documents are unchanged.
For a trusted oversized document, review the resource cost before raising the
existing limits. This is input preflight, not a parser process-memory sandbox.

Replica promotion now keeps the previous Chroma collection until staging has
successfully taken its stable name. A failed rename restores the previous name;
after a process interruption, the next collection access recovers a missing stable
name from its retained generation before it can create an empty collection.
If both generations remain after an interrupted cleanup, reads use the stable
collection and another promotion refuses to overwrite the retained generation.
Back up the store, inspect both collections, and archive the retained generation
before retrying. Rollback names are `netclaw-rollback-` plus the first 32 hexadecimal
characters of SHA-256 of the stable name. Existing corpus formats are unchanged.

Snapshot secret scrubbing now handles explicit type-0 and multiword enable
credentials. This changes future snapshots only. Review older indexed snapshots
privately and replace affected snapshots from trusted originals using the normal
snapshot workflow. Rotate an exposed credential through approved device change
management if it was disclosed; do not paste suspect content into audit reports.

Re-running the installer now preserves existing workspace `SOUL.md`, `AGENTS.md`,
`IDENTITY.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, and the workspace testbed
(including symlinks). Fresh installations receive repository defaults. Configured
`PYATS_TESTBED_PATH`, `RAG_DATA_DIR` and `MEMORY_DATA_DIR` values remain unchanged.
Review repository persona changes and merge useful guidance into your own notes.

No state conversion is needed for this preservation fix. Before upgrading an
older installation, privately back up its runtime directory and repository `.env`
and testbed. Existing data lost to a previous installer can only be recovered from
an existing backup; this change cannot reconstruct it.

Deployment and Forward credential setup use the shared literal dotenv writer:
values are quoted as data, files are atomically replaced with mode `0600`, and
symlink environment files are refused. A failed write stops normal deployment.
Move a symlinked environment file to a regular file only after preserving its
target and confirming the intended runtime. Do not source dotenv files as shell.

Regression evidence: `tests/unit/test_core_deploy_preservation.py` runs the real
deployment function in temporary directories for fresh/repeat installs, unusual
path characters, private permissions, and pre-existing operator state.

HUD skill/session detail identifiers now stay inside their resolved data roots;
encoded path separators and links outside those roots return404. Move a legitimate
resource into its managed directory instead of passing a path as its identifier.
No existing file is moved or rewritten. HUD budget status now preserves zero
ceilings and rejects invalid numeric overrides consistently with enforced limits.

Updated skill GAIT examples use `user_text`/`assistant_text`. Older nested `input`
or `prompt`/`response` calls can return success while recording empty text. Review
recent records with `gait_show`; missing historical content must be reconstructed
only from actual retained evidence, never from illustrative skill examples.

### Skill deployment recovery (A124-075)

Installer upgrades now retain originals of changed skills under the runtime's
`skill-deployment-backups/deploy-*` directories before replacing any files.
Each private generation contains a journal and original bytes. Repeated deployment
of identical content creates no new generation. Files absent from the repository
are preserved, and Hermes substitutions apply only to incoming files.

Preview skill changes without writing files:

```bash
python3 scripts/deploy-skills.py --source workspace/skills \
  --destination ~/.openclaw/workspace/skills \
  --backups ~/.openclaw/skill-deployment-backups --preview
```

Deployment refuses symlink destinations and symlink ancestors before updating
skills; use a regular skill directory to adopt this installer. Existing links are
left untouched. A failed deployment can leave a partially updated tree, but retains
all originals. Restore the generation printed by the installer with:

```bash
python3 scripts/deploy-skills.py --restore ~/.openclaw/skill-deployment-backups/deploy-EXACT_GENERATION
```

Restore checks all target digests before writing and refuses subsequent local
edits. Resolve such conflicts manually using the retained originals; do not force
an older generation over newer changes. Restore removes only newly deployed files
whose bytes still match the journal and restores replaced files with their former
permissions. Recovery is repeatable and keeps the journal. Review/merge operator
skill customizations from the originals after an upgrade.

A124-076 corrects edge queue TTL enforcement when a phone reconnects without a new enqueue. Expired messages are excluded from replay and pending counts; the next enqueue performs existing cleanup. No database conversion is needed.

A124-077 validates optional pricing override shapes and numeric ranges. Invalid entries now warn and use default pricing. If direct usage accounting supplies an invalid/non-finite cost, the session ledger halts with `invalid_cost`, reports its total as incomplete and refuses a budget override. Correct the usage source before starting a new ledger. Valid zero/positive costs and existing stored data are unchanged. Estimates are not provider invoices.

A124-078 adds Fortinet `request_failed` for malformed/error JSON-RPC replies. Consumers must treat it as an unavailable answer, not a successful empty inventory. Valid empty lists remain `empty_result`. A124-079 supports fractional `BGP_INTEL_MAX_RPS` below1 with a longer pacing window; no state migration.

### Production model routing (A124-080)

Production delegation now requires DefenseClaw mode and a configured model route
through the local guard provider. Proxy reachability alone is insufficient.
Primary models, embedded `--model` overrides and configured fallbacks must use
`defenseclaw/<model>`, and that provider's `baseUrl` must use the configured
loopback guard port. The effective `OPENCLAW_CONFIG_PATH` (or state directory)
and selected `N2N_AGENT_ID` are inspected. Direct-provider members created by
`in2n-member-home.py` remain suitable for explicitly unguarded testing; they do
not satisfy production admission without reviewed provider configuration.

Preview the current admission decision without changing configuration:

```bash
PYTHONPATH=mcp-servers/protocol-mcp python3 -c \
  'import asyncio; from bgp.federation.controls import defenseclaw_available; print(asyncio.run(defenseclaw_available()))'
```

Before adopting production, retain private copies of the effective member/gateway
config and `~/.openclaw/config/openclaw.json`. Configure the intended DefenseClaw
provider, primary and fallback routes, and guard mode using the existing local
setup workflow. Run the preflight again, then verify an actual guarded model turn
with your provider. Recover mistaken configuration edits from those private copies;
the admission check does not write files or credentials. Do not automatically
switch to testing to bypass a failed production check. A successful preflight
establishes configured routing and local proxy liveness, not an end-to-end proof
of the external guard's content decisions.

A124-081 rechecks grants, federation status, knowledge visibility and budgets after
approval/guard waits. An approval cannot authorize a revoked or replaced grant.
Request allowance is reserved before skill execution and now includes replication
reads; already admitted work is not cancelled by later revocation. Successful skill
completion adds actual tokens without charging a second request. Existing SQLite
rows need no conversion. Review daily limits if a deployment previously depended
on uncounted replication calls; do not raise limits automatically.

A124-082 makes platform setup prompts literal and uses the same private atomic
writer as installation. Hermes conversion decodes quoted dotenv correctly and
writes generated config/sidecars privately; MCP cwd normalization also writes
atomically. Re-enter any credential previously corrupted by the old setup writer
from its trusted original. Regenerate Hermes MCP YAML into its sidecar and merge
it deliberately with existing server configuration. The existing local-file
permission migration remains available for older credential-bearing files.

A124-083 rejects malformed Claroty/Halo/Auvik list responses. Halo/Auvik keep
already collected items with explicit error/truncated fields; Claroty reports an
error through its existing tool handler. Valid empty arrays remain valid, as does
Halo's explicit zero-count metadata response. No stored data conversion is needed.

A124-084 changes repeat platform setup to preserve operator content. Identity
fields occupy a delimited managed section in USER.md; prose outside it remains
untouched. Voice setup merges the requested phone entry, preserves existing call
permissions and unrelated quiet-hours/rate policy, and never activates the example
phone number. Changed original files are retained privately in `.setup-backups`
beside each target, named by filename and original content digest. Compare the
original with the current file before manually recovering it, preserving any later
edits. Repeated identical updates do not create additional copies. Malformed state
and linked destinations are refused instead of overwritten. No call is initiated.

A124-085 stores each federation result in a unique private file independent of
peer-chosen request ids. Existing database references and old filenames remain
readable; no conversion is required. Missing payloads are explicitly unavailable,
and persistence failure produces a failed task even if its error payload cannot
be saved. An execution may already have happened before persistence failed:
inspect the target state before retrying a mutating task. Older results already
overwritten by an id collision can only be recovered from an earlier backup.

### Standalone setup (088–089)

Standalone CheckPoint/IPFabric/Forward/Twitter/Twilio setup now preserves literal credentials with private atomic dotenv writes. Twilio whitelist edits retain other policy entries and save private originals under `.setup-backups` beside the config; CheckPoint placeholder pruning uses the same retained-original mechanism. Compare the retained original with current state before any manual recovery, and retain newer operator edits. Historical overwritten values require an earlier backup.

Peering setup decodes dotenv as data and starts the daemon with selected literal settings; rerunning configuration no longer evaluates prompt input. Twitter OAuth callbacks require matching state and finish within five minutes; token exchange has a30-second timeout. Retry authorization if it expires. Tokens are saved privately, never printed. Existing tokens/config need no format migration. Required standalone dependency/build/smoke failures now stop setup; use a configured virtualenv with the documented shared pip helper on PEP668 hosts.

### TLS startup and registration (090)

CATC, GNS3, EVE, Auvik, Halo, SuzieQ and Claroty now verify server identity when a TLS setting is blank, unresolved or misspelled. Only explicit `false`, `0` or `no` opts out. For production private CAs, install the trusted CA for the relevant client instead of disabling verification. Zabbix uses a first-party launcher that normalizes its TLS flag before starting the unchanged vendored program.

Preview existing OpenClaw registration adoption, then apply after preserving the installation:

```bash
python3 scripts/migrate-tls-registration.py --config ~/.openclaw/openclaw.json
python3 scripts/migrate-tls-registration.py --config ~/.openclaw/openclaw.json --apply
```

This updates only known old CML/Redfish fallback strings and the known old Zabbix launch arguments, preserving credentials, interpreter paths and unrelated configuration. Custom Zabbix launch arguments are refused for manual review. Repeating a successful apply is unchanged. A private `.pre-tls-registration` original and digest journal are retained beside the config. Use `--restore` to preview recovery and `--restore --apply` to restore only when no later edits conflict. Restart affected MCPs and verify health; the migration makes no provider calls. Other runtimes need the equivalent launcher/default changes in their own config and a preserved original.

### Verdict consumers (091–092)

ANTA results previously hidden by broad applicability keywords now remain `fail` unless every message is a recognized command-unavailable diagnostic. Redfish adds `POWERING_ON` and `POWERING_OFF`; downstream consumers must display these as transitions and wait for a subsequent BMC observation before declaring completion. `POWERED_ON` and `POWERED_OFF` retain their meanings. These are response-semantic corrections, with no destructive stored-data migration.

### Federation chat sessions (093)

Ordinary UUID sessions remain usable. IDs must now be1–128 ASCII letters/digits/dots/underscores/hyphens beginning with a letter or digit, and must belong to the same peer and direction. Open a new session for an old malformed id; do not move or import files named by an untrusted id. Existing valid transcript files remain in place and become0600 when appended. New lines quote/escape embedded text so a peer cannot forge another transcript line. Storage failure now fails the call visibly. Request allowance is reserved before model execution; a failed attempt can consume a request, so inspect the result before retrying. No transcript purge or operator state migration is required.


### Certificate renewal and process cleanup (094–096)

Routine pinned-host renewal now replaces the certificate atomically while retaining its private key. ACME renewal requests lego's `--reuse-key` (supported by the pinned 4.19.2 client), preserving peer SPKI pins. Unchanged certificates are reported as renewal failures, and same-key successors remain active. Heartbeats expose the current credential registry state, including failed renewal; unregistered credentials report unknown. CA/hub helpers only create credentials when absent: their output is not automatic renewal. Coordinate CA/hub renewal or deliberate private-key replacement with affected peers and re-verify pins; automatic successor-key overlap is not implemented.

No certificate or key is replaced during source upgrade. Existing credentials and pins remain readable. Preserve private keys and the federation database before any operator renewal. Inspect failed/expired registry entries and peer connectivity before retrying; do not clear mismatched pins without verifying the new identity. ACME timeout/cancellation now terminates and reaps its owned process group, preventing abandoned DNS renewal processes. The regression acceptance uses local fixtures, not a live CA or DNS challenge.


### Inventory advertisement and cache (097)

Hidden member-aggregate skills now remain hidden. Advertisement secret checks decode literal dotenv values and inspect effective secret-named environment settings; unreadable/malformed secret sources fail advertisement. Old valid peer cache names remain readable. Unsafe peer ids and linked cache files are refused; obtain a fresh inventory for such entries without following or importing the old paths. Missing, invalid or future timestamps are stale, and UTC timestamps are interpreted independently of local timezone. New cache writes are atomic/private. No operator cache purge or bulk rewrite is needed.


### Replication preservation (098)

New transfers, including repeated initial requests, write unique staging collections. Invalid/duplicate pages fail before publication. Existing stable corpus and registry remain intact on transfer, vector promotion or registry-publication failures; registry replacement occurs in one SQLite transaction. Existing successful replicas keep their names and need no format conversion. Previously lost replicas require a retained backup or a newly authorized transfer.

SQLite and Chroma are separate stores: abrupt termination between their commit points is not a distributed atomic transaction. Before retrying after a killed process, preserve the RAG directory and inspect pending staging registry rows, stable vectors and `netclaw-rollback-*` collections together. Do not purge retained rollback generations or rerun promotion blindly. The store refuses a new promotion when a rollback generation remains. A completed registry publication plus retained rollback means the new generation is published; uncommitted staging rows plus rollback require recovery of the old generation or deliberate completion after validating counts and provenance. No automatic operator corpus migration or deletion occurs during upgrade.


### Canvas conversation persistence (100)

IndexedDB session formats are unchanged. Canvas now requires pending replies or session saves to finish before switching/importing/deleting sessions, keeping node-id reuse from misattributing replies. Storage failures are visible and retain the current conversation. Deleting the active session no longer re-saves it while creating a blank session. Existing resurrected duplicates can be reviewed and deleted normally; no bulk removal or browser-data migration is performed.


### Mobile device links (102)

Automatic device-status links now accept exactly one inventory identifier of1–128 ASCII letters/digits/dots/underscores/colons/hyphens, starting with a letter or digit, and no user-info, port, query or fragment. Regenerate an old incompatible QR/link with a valid identifier, or type the intended request manually in Chat. Existing enrollment, conversation and device data are unchanged; no stored-state conversion is needed. This bounds untrusted link input and does not replace the Border's execution authorization.

### Mobile lifecycle (103)

Install the rebuilt mobile app to adopt owned connection/listener cleanup and selective background-engine plugin registration. Enrollment, credentials and conversations retain their formats; no data reset is required. Simulator compilation does not prove background execution on a physical phone.
