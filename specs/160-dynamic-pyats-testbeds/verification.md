# Spec160 verification — 2026-10-30

## Status and scope

Source implementation is complete on `160-dynamic-pyats-testbeds`, based on
`7ba5de101ca229d457d3981d46c9c259dbc75b4e`. Source version **1.14.0** and extension
**1.4.0** are prepared locally with history/release notes. Nothing is published,
merged or installed into an existing owner runtime. No provider, source tenant,
lab device, TCP reachability probe or configuration operation was invoked.

Automated acceptance, actual upstream MCP acceptance and native Mac installer
selection/save/reload acceptance pass. The successful desktop host was official
VS Code 1.145.0 Insiders; stable/minimum-version attempts retain the limitations
below. Implementation completion and live/platform qualification are separate results.

## Runtime evidence

- Upstream: `automateyournetwork/pyATS_MCP`, revision
  `4a3c1e3404d5ed7a78cb094bf26d2a49065497d9` (October 28).
- Actual upstream discovery: **34 tools**, including **8 dynamic testbed tools**.
  Managed discovery: **35 tools**, adding `netclaw_testbed_compose`.
- Research environment: `/tmp/netclaw-spec160-native-tests-20261030`, isolated
  Python 3.12.12 / pyATS, Genie, Unicon 25.2 / MCP 2.3.0.
- Fresh install with the changed installer succeeded into
  `/tmp/netclaw-spec160-installer-20261030/pyats-venv`, a symlink to private
  `.pyats-venv-generation-6u1jac0q`. Its generation marker records the exact pin.
  The installer acquired 150 packages without modifying an owner Python environment.
- The fresh installer-built runtime passed all **6 native acceptance tests** in
  15.546 seconds on the final run: every source's actual build/schema/activation/list,
  raw fetch refusal, missing credentials, immutable names, active deletion refusal,
  restart, bounded one-process CLI, static default compatibility and concurrency guard.
  The test includes a real two-source CML + NetBox candidate and verifies a rejected
  partial refresh leaves that candidate active. Concurrency is a controlled lock test;
  no live device job was created.
- All source records/credentials are explicitly synthetic. Real MCP transport and
  real pyATS schema loading are exercised; device connectivity/login are not.

The upstream investigation reproduced active-name replacement, activation without
validation, static fallback, process-local registry loss and unsafe raw-fetch/merge
behavior. The managed boundary addresses those observations; it is not an assertion
that the unmodified upstream native fetchers have been qualified.

## Checks run

| Check | Actual result |
|---|---|
| Upstream server/task/builder suites | **196 passed**; pinned fresh checkout, 1.81s final run. These suites include mocks. |
| Pure source normalization / adversarial contracts | **15 passed**; all 14 selections, cross-composition, scope, stale snapshots, partial/empty pages, OS/address ambiguity, conflicts and credential references. |
| Actual managed MCP | **6 passed** against fresh installed runtime, described above. |
| Terminal policy/plan acceptance | **4 passed**, including controlling PTY entry through `install.sh --emit-plan` and `setup.sh --testbed-only`; private plan/env readback, cancellation and static-file preservation. |
| Setup regression family | **272 run: 240 passed, 32 skipped**, 41.892s. Existing opt-in native/live suites remain skipped; no missing qualification was converted to a pass. |
| Readiness, runtime recovery and core deployment | **29 passed**, 11.97s. Dynamic policy requires no static path/placeholder; failed generation retains recovery and operator files/credentials. |
| Existing HTTP bridge regression | **11 passed**, 3.37s. |
| Extension suite | **150 run: 147 passed, 3 skipped**, 28.914s on Node 24.19.0; includes four new real-controller policy/picker tests. |
| HUD unit suite | **383 passed**, 6.754s. Subsequent focused testbed/MCP suite: **11 passed**, including the newly added dynamic-path requirement test. |
| Extension build | PASS, version 1.4.0. |
| Catalog metadata/generation/coverage | PASS: 110 components, 237 skills, 124 registered + 52 external integrations = 176. No unexplained gaps or count changes. |
| Public catalog links | 165 verified, 0 dead, 2 need external review. Feature pyATS link and all 11 external source-contract references separately verified (HTTP 200). |
| Shell effects audit / Bash syntax / changed Python compilation | PASS. |
| Release metadata and whitespace | PASS, source 1.14.0; no incomplete release placeholders. |

Reproduce native acceptance with a freshly installed isolated runtime:

```bash
PYATS_TEST_RUNTIME=/absolute/private/pyats-venv \
PYATS_TEST_UPSTREAM=/absolute/private/pyats-venv/upstream/pyats_mcp_server.py \
/absolute/private/pyats-venv/bin/python -m unittest discover -s tests \
  -p test_pyats_dynamic_runtime.py -q
```

The default native test invocation skips when the two isolated paths are absent.
It must never silently select an owner environment. CI now runs normalization and
terminal contracts and includes the upstream builder suite in the pinned pyATS
contract runner. Local CI-equivalent checks are not a claim of a remote CI run.

## Installer and UI boundaries

- **Terminal:** actual private controlling-terminal prompts completed for a new
  Hermes draft and existing selected-runtime policy. No new home was installed by
  drafting. Dynamic sources read back as CML + NetBox. Keep/cancel/static/dynamic
  paths preserve credentials and the operator file. Pure plan/deploy tests cover
  selected-claw ownership, dynamic output recovery and independent neighboring claws.
- **VS Code controller:** actual `SetupWizard.action` implementation exercised with
  native prompt adapters; all 14 canonical cards, source prerequisites, native
  confirmation before planned static-import removal, cancellation at both pickers
  and confirmation, member isolation, saved-draft reload and component invalidation.
  These are controller tests, not human-visible desktop acceptance.
- **Desktop attempt:** official VS Code 1.109.0 development host opened the NetClaw
  sidebar and Set Up a NetClaw tab, but the webview stayed blank in multiple private
  profiles. Reload, fresh app copy and `--disable-gpu` did not establish a visual
  pass. No extension error explaining the blank surface was found in collected
  host/renderer logs. Official stable 1.144.0 was independently downloaded and
  SHA256-verified, but the computer-use surface did not advance its onboarding
  controls or expose the editor tree reliably. No root cause or product fix is
  claimed from that evidence. The successful isolated acceptance below resolves the feature-selection workflow;
  stable/minimum-version visual qualification remains open.

- **Actual native visual acceptance — PASS, bounded scope:** official VS Code
  1.145.0 Insiders (`cd2259bdf72ec7421e70ae80999ceb46f8bd86fe`), downloaded from
  Microsoft's update service and SHA256-verified
  (`6a47c4093ea5998538ed5fb31b69d091b936c1d44a3aa2c602d34cdc6ac89004`). A separate app
  identity and private user-data/extensions directories exposed the actual webview
  and native prompts to computer use. Imported a synthetic partial Hermes draft,
  opened the native Static/Dynamic picker, observed **14 Results**, selected **CML
  and NetBox / 2 Selected**, and verified the dynamic summary. Saved
  `dynamic-saved.json` through the native file dialog. Reopened the picker and
  cancelled; the summary remained dynamic/CML/NetBox. Reloaded the editor, reopened
  the wizard and observed the same persisted selection. Explicitly switched to
  Static and saved `static-saved.json`; the summary returned to Reviewed file.
  Independent file assertions confirmed both exact policies, empty inventory effects
  and **0600** saved files. Dynamic output is in the private temporary workspace;
  static output is in `netclaw-handoffs/spec160-editor-20261030`. The native dialog
  returned a symlinked `/tmp` path after reload; the existing guard refused it. Using
  the canonical private handoff directory succeeded without weakening the guard.
  This tests drafting/selection, not provider setup or an entire new runtime
  deployment. It does not replace stable-editor qualification.

## Source qualification matrix

All rows have a visible catalog choice and pass synthetic normalization plus actual
upstream build/schema/activation. **No row has live source or device qualification.**

| Source | Contract exercised | Live prerequisite / limit |
|---|---|---|
| Itential | Inventory Manager node attributes | Authorized scoped reader and complete pages |
| NetBox | Primary address/platform slug | Actual tenant, pagination and IPv6 mapping when needed |
| Nautobot | Bundled MCP response projection | Stable identity enrichment and complete paging; native REST schema differs |
| Catalyst Center | Device response and OS mapping | Installed `catc_*` discovery, scope and all pages |
| CML | Node + management enrichment | Actual lab/interface observation; console is not SSH |
| containerlab | Brief inspection + kind mapping | Exact lab, independent SSH facts; omit container environment |
| EVE-NG | Node + management enrichment | Lab/pagination evidence; console-only record is refused |
| GNS3 | Node + management enrichment | Project/node identity and observed management endpoint/OS |
| ServiceNow | Explicit CMDB export projection | No verified bundled CMDB read tool; authorized Table API export or discovered reader |
| OpsMill Infrahub | Explicit normalized custom-schema export | Discover schema/branch and complete JSON projection |
| IP Fabric | SDK8 login address projection | Concrete snapshot ID/capture time and explicit mapping for older versions |
| Forward | Explicit normalized export | Actual network/snapshot/device schema; no invented bulk-reader contract |
| Structured | Reviewed canonical JSON records | Trusted extraction and scoped provenance |
| REST export | Reviewed extracted records only | Existing authorized reader handles origin/TLS/redirect/pagination; raw pyATS fetch is blocked |

Additional unqualified rows: Linux/WSL/native-Windows installer UI, actual OpenClaw
and Hermes persistent-agent sessions with live source readers, provider inference,
device reachability/login/commands, collectors and Terminal Intent dynamic consumption.
The latter remain explicitly separate static consumers, not unimplemented implicit
promises of this feature. Existing change control and collector scopes are unchanged.

## Failures corrected and residual evidence

- Catalog baseline/generation drift after changing pyATS metadata: regenerated and
  updated the intentional baseline; full setup family then passed.
- Test fixtures missing new helper dependencies: expanded the synthetic deployment
  checkout; existing preservation and new dynamic deployment tests passed.
- PTY harness initially used a nonexistent flag and wrong prompt order: corrected to
  actual `--emit-plan` and canonical field order; actual terminal acceptance passed.
- First native async harness crossed AnyIO cancel-scope tasks, and a fixture used a
  symlinked `/var` path: corrected test context lifetime and resolved fixture paths;
  no production path guard was weakened.
- An extension run used unsupported system Node 25.3.0 and failed the existing HUD
  launcher runtime gate. Rerunning on qualified Node 24.19.0 passed all 147 tests.
- One fresh upstream test checkout failed DNS resolution. Retried successfully with
  the exact pin; all 196 tests passed. Earlier research and fresh runtime install
  had already acquired the same revision independently.
- No live-services evidence, stable-editor visual pass, publication or owner upgrade
  is inferred from the automated results. The separate native Insiders pass above
  is recorded as an observation, not inferred.

## Requirements reconciliation

| Requirements | Evidence |
|---|---|
| FR-001 / SC-003 | Pin, fresh generation install, 196 upstream + 6 native + runtime/bridge recovery tests |
| FR-002/003 / SC-001 | Plan semantics, private deploy recovery, real terminal prompts, extension controller tests; native Insiders visual/readback pass and stable-editor qualification limit above |
| FR-004/005 / SC-002 | Canonical 14-source catalog, researched source matrix, 15 normalization tests + actual upstream fixtures |
| FR-006/009 | Immutable lifecycle, separate activation, one-process helper, restart/static compatibility and no device I/O |
| FR-007/008 / SC-004 | Device-only env references, projection/redaction, raw-fetch/merge refusal, private files and negative tests |
| FR-010/011 | Mode-aware readiness and structural report projection; source catalog, docs, skills, HUD labels and generated parity |
| FR-012 / SC-005 | Actual stage/platform matrix, explicit skips/limits, local history and GAIT; stable-editor/live qualification remains separately visible |

## Source control and audit

Final cross-artifact review maps all **12 functional requirements and 5 success
criteria** to the evidence above, with no unresolved implementation inconsistency.
All **30/30 implementation tasks** are complete. The qualification limits remain
separate from implementation task completion.
Final review covered 112 changed/new public files and passing whitespace/local-doc
link checks. A bounded known-secret-pattern scan found only an unchanged README
example already present in the base commit; no runtime environment, database,
private key or packaged binary is included. This scan supplements the reviewed
credential/reference and structural-report boundaries; it is not a general secret
detection guarantee.

GAIT session `dynamic-testbeds-20261030` records research `c3a6ad02`, implementation
`ec25b068`, automated verification `9d35a250` and native UI/reconciliation `e88b5284`.
Local commits: `46441f7` defines the specification/contracts and `f982300` contains
the implementation, tests, installer/docs updates and version history. This evidence
and the completed task list follow in a separate local documentation commit.
The final commit IDs and session-end GAIT reference are also retained in the local
daily memory; `gait_log` displays the session trail. Work remains on
`160-dynamic-pyats-testbeds`; no push, PR, merge or release was performed.
No issue or external milestone was posted. A local [milestone draft](milestone-draft.md)
is provided for later review/publication.
