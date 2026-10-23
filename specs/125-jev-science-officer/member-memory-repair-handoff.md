# Local member memory verification repair — 2026-09-27

## Confirmed fault

`memory-mcp` expanded the default data path but not an explicitly configured
`MEMORY_DATA_DIR=~/.openclaw/memory`. That value therefore created a literal `~`
directory under the process working directory. Border and member processes could
query different databases despite apparently identical configuration. The
deployment-specific operator decision existed in the checkout-relative store and
was absent from the intended home-directory store.

The server now expands and resolves the configured path before starting SQLite
or Chroma. Two process-level regression tests verify cross-working-directory
decision visibility and preservation of an explicitly chosen absolute directory.
The focused unit/integration run passed all 20 tests.

## Local migration and preservation

The gateway and four local member services were stopped during reconciliation.
Both SQLite stores were backed up using SQLite's backup API; both Chroma
directories and all five runtime configurations were preserved. There were no
record-ID collisions and neither Chroma store contained semantic session entries.
All structured rows were merged into the intended home-directory database and
compared field-for-field against both snapshots; SQLite integrity passed.

Final totals: 265 facts, 11 decisions and 2 graph links. Four active entity/key
pairs existed in both sources; both versions remain visible and require evidence
review if used. No fact was silently selected, superseded or discarded. Unrelated
OpenClaw memory indexing data was untouched. All five runtime MCP configurations
now pin the same absolute directory. Services were restarted. Private backups,
manifest and readback evidence are under
`~/.openclaw/member-memory-repair-20260927`; originals remain preserved.

## Acceptance limits

The existing decision `aa24cb7a32d4a1fc` is readable through the canonical memory
MCP tool with its original creation timestamp. A separate guarded member
diagnostic was refused by model-guard before its memory lookup, so that probe is
not an end-to-end acceptance pass. No guard was weakened and no deployment was
submitted by this repair. Correct shared storage does not guarantee a future
model accepts a request or a deployment completes.

Memory visibility is not a new authorization mechanism. The original operator
decision and its exact scope must still be checked by the executing member;
memory contents cannot override platform controls. Jev assessment records remain
in the Jev ledger, not in memory-mcp unless explicitly recorded there. Semantic
recall is not a substitute for a structured decision lookup.

## Moving to another development box

Pull the source fix, inspect actual memory paths and reconcile any literal-tilde
stores before restarting. Do not overwrite a populated destination or copy a live
SQLite database without its transactional state. If Chroma contains sessions, it
needs its own preservation/merge procedure; this local migration did not exercise
that case. Pin an operator-selected absolute path shared only by the intended
local RISK processes. Different hosts and different users are not automatically
federated by this change. Verify structured decision readback from each relevant
configuration; no fresh macOS/native-Linux live acceptance is claimed here.
