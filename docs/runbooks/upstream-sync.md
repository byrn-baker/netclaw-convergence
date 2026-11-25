# Keeping Convergence aligned with NetClaw

Convergence extends `automateyournetwork/netclaw`. Merge upstream history into
this fork; do not replace upstream features with a separate implementation.
The fork's live OpenClaw configuration is not the repository's installer template.

## 2026-11-25 integration

- Upstream: `8d641c6c` (source **1.26.0**), 503 commits since the previous
  merge base `4d791a36`.
- Fork baseline: GitHub `main` `024821c8`; rollback branch
  `backup/pre-upstream-sync-20261125-024821c8`. The local `main` checkout was 16
  commits behind GitHub `main`; always sync from GitHub `main`.
- Owner decision (2026-11-25): keep the fork's Convergence code (option 1).
- 43 files conflicted. Fork Convergence commits had touched 41 of them.

### Resolution decisions

**Where upstream took over fork work, upstream's version wins.**
- **What upstream absorbed:**
  - the RAG JSON/OpenAPI ingest, HTML quality warnings and investigation-snapshot
    search (spec 194);
  - the skill guardrails (spec 192);
  - `n2n_task_wait`;
  - hub credential renewal (spec 180);
  - the GreyNoise server (spec 195);
  - the MCP-template price handling (`load_mcp_template`);
  - the gateway-token `${...}` resolution.
- **Silent merge bug.** The auto-merge left two `_parse_json` definitions in
  `rag-mcp/ingestion/parsers.py`, so upstream's file was taken whole.
- **Fork differences kept on top of upstream:**
  - the GCF serialization in `n2n-mcp` and GreyNoise;
  - the member role pin in the delegated-skill prompt, now followed by
    upstream's `SKILL_FAILURE_RULE`;
  - the `network-guardian` and `guardian-claw` member profiles;
  - the pfSense and UniFi MCP defaults;
  - the SuzieQ response limits;
  - the private-runtime `mkdir -m 700`;
  - the `install-steps.d/` fragment hook.

**Version line.** The fork's own releases 1.15.0, 1.15.1 and 1.16.0 (specs
1010–1012) collided with upstream's numbers. The fork now follows upstream's
`VERSION` (1.26.0). The fork's release notes moved to
`docs/releases/convergence/`, under a "Convergence fork releases" changelog
section.

**Convergence naming.** Upstream's `docs/CONVERGENCE.md` and `convergence-setup`
skill describe the convergence-platform connector, so they keep those paths.
- The fork's in-tree stack guide is now `docs/convergence/README.md`.
- Its setup skill, with its scripts, references, CI workflow and tests, is now
  `convergence-stack-setup`.
- In the HUD, the fork workspace's view id is `convergence-home`; see
  `ui/netclaw-visual/FORK-NOTES.md`.

**Catalog and manifests.**
- **`catalog.json`:** merged entry by entry. Fork components were renumbered after
  upstream's 7 new ones.
- **`catalog.sh` and `env-map.js`:** regenerated.
- **`effects.json`:** rebuilt from upstream's entries plus the fork's Convergence
  entries. The install-steps source, fragment and `suzieq` function hashes were
  refreshed after reviewing the installer diff against upstream, which contains only
  the three fork additions above.
- **Protected n2n source allowlist:** upstream's three hashes plus the merged
  file's hash. The old fork hash was dropped.
- **`tests/contract-suites.json`:** upstream plus the fork-only suites
  (`convergence-home`, `convergence-host`, `convergence-host-status`).
- **Inventory counts:** computed by `verify-inventory-counts.py`.
  - 257 skills: upstream's 243 plus the fork's 14.
  - 185 MCP integrations: upstream's 183 plus pfSense and UniFi.
  - 132 registered servers.

**Behaviour change for fork tools.**
- **`docs-site-to-pdf.py`:** now verifies TLS unless `--insecure` is given, matching
  upstream's rag-mcp. LAN appliances with self-signed certificates need `--insecure`.
- **GreyNoise:** looks up public IPv4 addresses only. Its compatibility test now uses
  a public address.

**Guardian member profile (upstream spec 183).**
- **Skill bindings:** `alert-triage` and `wifi-diagnosis` are now bound in the
  catalog to the servers their instructions call:
  - `alert-triage`: Grafana, GreyNoise, pfSense, Prometheus, pyATS, RAG and UniFi;
  - `wifi-diagnosis`: UniFi.
- **Profile servers:** the `network-guardian` profile keeps exactly that set, so it
  gains `unifi-network`.
- **Alias removed:** the `guardian-claw` alias key was not a profile.
  `ensure-guardian-claw.py` enrols through `network-guardian`.
- **Shared secrets:** `DISCORD_` was removed from the Guardian's environment slice,
  because members never receive shared channel secrets.
- **Live effect:** existing member homes are unchanged. Only a regenerated Guardian
  member gets the new slice.

**Submodules removed.**
- **`threatintel-mcp`:** upstream installs it from a pinned checkout through
  `scripts/setup-threatintel.py`.
- **`nautobot-firewall-mcp`:** nothing referenced it.
- **`.gitmodules`:** removed. Four of its six entries were already stale.
- **Why:** upstream's separate-claw deploy refuses submodule directories in its
  source set.

### Verification (2026-11-25, `umask 077`, isolated contract environments)

- **Static checks** all pass:
  - catalog generation parity, metadata (129 components, 257 skills), links,
    coverage and inventory counts;
  - `EffectAudit.verify`;
  - all six `reconcile-mcp.py` surfaces;
  - `verify-spec-artifacts.py` (214 specs).
- **Ruff F/E9:** the merge introduced no new findings compared with the same files
  on either parent.
- **Contract suites:** 38 pass. `setup-installer` and `n2n` pass after the fixes
  above; `n2n` is about 2,700 tests.
  - **Need live credentials:** anta, catc, cisco-iq, cisco-psirt, fortinet,
    globalping, k8s and zabbix.
  - **Need Docker:** multivendor, nsm and redfish.
- **Environmental failures (reproduced and explained):**
  - `unit` `test_jev_core.py::test_existing_nonprivate_directory_not_silently_chmodded`
    assumes umask 022 and passes under it.
  - `test_hermes_hud_installer` needs `ui/netclaw-visual/node_modules`, and
    `setup-installer` refuses the hard-linked binaries `npm ci` creates there. Each
    passes in its own environment.
  - `integration` `test_rag_mcp.py` needs `fastmcp-tasks`, which upstream's
    integration environment does not install. The inputs are identical to upstream's.
  - `test_threejs_network_viz` needs Chromium's `libatk`, which this host lacks.
  - `convergence-read-integration` is a held suite that needs
    `CONVERGENCE_TEST_SERVICE_CHECKOUT`.
- **Runner workaround:** upstream main's `run-contract-tests.py` refuses every suite,
  because `tests/azure` has no manifest entry. A temporary, uncommitted `azure`
  entry was used to run the suites.
- **HUD:** 558 of 558 tests pass; the production build succeeds.
- **Host note:** a checkout with group-writable directories (this host's umask 002)
  fails the protected-source and installer guards, producing 155 `n2n` errors.
  Remove group write from the worktree before testing.

## 2026-10-30 integration

- Upstream: `b18d51c091fe4c854f970a9c55c84342eb173018`, source **1.14.0**,
  VS Code extension source **1.4.0**. This incorporates 39 upstream commits
  since the previous `45a333ed` baseline (1.11.0).
- Fork baseline: `2c1270e9`; rollback branch
  `backup/pre-upstream-sync-20261030-2c1270e9`.
- Included: dynamic pyATS testbeds, separate-claw IDE installer, guided Comms,
  optional MCP environment defaults, official Forward MCP, and chat recovery.
- Convergence module, HUD backend extensions, IDS shipper/ingest, Helm charts
  and live cluster profiles retain their pre-merge contents. The recent IDS
  replay optimization and feed-refresh repair remain intact.

### Compatibility decisions

The upstream canonical catalog now describes the fork's 12 legacy installer
components and 14 additional skills. The Convergence components are explicitly
**unsupported in the separate-claw wizard** until that deployment path is
qualified. The legacy Convergence profile and Helm runbooks remain available.
The upstream `full` wizard profile remains upstream's selection; the historical
shell installer's `full` continues to include the add-ons.

`scripts/build-catalog.py` retains the optional `catalog.d/` hook. The Convergence
fragment avoids duplicate registration when the generated catalog already
contains its entries. Edit canonical metadata and regenerate both the shell
catalog and HUD environment map; do not hand-edit generated outputs.

Installer coverage checks include `install-steps.d/`. The reviewed effects
manifest binds the exact fragment bytes as well as the core installer. Unknown
or changed fragments fail verification. They do not acquire wizard support by
appearing in this manifest.

Fork-only SuzieQ, pfSense and UniFi optional values use upstream's literal
`config/mcp-env-defaults.json` mechanism. No shell fallback expressions remain
in the template. Provider/model settings are preserved, including decimal
prices: `load_mcp_template` validates the MCP subtree with the strict setup
grammar without treating unrelated model prices as plan integers. Duplicate
JSON keys and non-integer MCP values remain rejected.

The optional upstream Ollama MCP template is restored for catalog parity. This
does not register it in an installed runtime or add it to Guardian members.
The corrected GitHub member mapping remains `github-mcp`; Forward follows the
new `forward-official-mcp` registration.

The protected Hermes NCFED source allowlist includes the merged n2n server hash
`93480c7e6ada546f90fda49055bdcc6863d1ef414f214b3a7aeac0fb27943872`.
Reviewed fork differences are GCF output serialization and the bounded task-wait
helper. The protected tool allowlist is unchanged; the new helper is not added
to that allowed tool set.

### Verification

- HUD: 392 unit tests; all 35 Canvas suites; production build and bundle budget.
- Setup installer: 272 tests, 240 passed / 32 opt-in native or live tests skipped.
  Subsequent focused catalog/deployment checks include two additional add-on
  isolation and fragment-tamper regressions.
- Optional defaults and profile preservation: 14 passed, one opt-in skip.
- Dynamic testbed normalization, pyATS recovery/HTTP bridge and installer
  readiness: 51 passed. Pinned upstream pyATS contract runner also passes with
  its declared isolated MCP 2.3.0 environment.
- IDS: 42 tests; Helm: 10 tests after building the local chart dependency.
- All six MCP reconciliation surfaces, catalog metadata, generated parity and
  whitespace checks pass.
- Extension source: TypeScript check and build pass; 141 tests pass and three
  opt-in tests skip. Six lifecycle tests are blocked by this host's existing
  group-writable `~/.openclaw/mesh.systemd.env`, encountered while discovering
  neighboring systemd services. The same failure reproduces in an untouched
  checkout of upstream `b18d51c0`. No lifecycle guard was relaxed and no native
  service configuration was changed. This is not a full editor-lifecycle pass.
- Hermes contracts: 24 passed / six native fixture skips, plus two runtime
  selection tests. The real pinned companion with controlled provider passed
  five of six integration tests together; its restart test initially received
  HTTP 503, then passed independently (17.6 seconds). This remains a recorded
  transient integration-test failure, not an unconditional full-suite pass.
- Spec artifact checker: **46 pre-existing findings**, identical before and
  after integration. No new finding was introduced or suppressed.

The checks above use synthetic/local fixtures. They do not qualify every
dynamic inventory provider or upgrade a native OpenClaw/Hermes installation.
Upstream's own platform qualification limits still apply.

## Live verification

The live checkout fast-forwarded to merge commit `df368e68`; its parents are
fork baseline `2c1270e9` and upstream `b18d51c0`. The HUD build was published
atomically with previous hashed assets retained, and only `netclaw-hud` was
restarted. Gateway and Vite preview services remained active.

Live browser verification shows Convergence inventory (304 ports), active IDS,
and recovery from a browser-only degraded response on the next automatic
refresh while the Security navigation button retains focus. The runtime API
reports OpenClaw ready; this readiness check does not submit a model turn.
Native `~/.openclaw/openclaw.json` and `.env` SHA-256 values match the pre-update
snapshot. All eight Argo applications are Synced/Healthy; no chart, storage,
sensor deployment or live pyATS testbed was changed.

Tracked checkout files and their directories had group/world write bits removed
so upstream's protected setup-source validation works in the live checkout too.
Executable bits and runtime file permissions were preserved. The host mesh
file limitation described above remains separate.

## Daily sync job

`.github/workflows/upstream-sync.yml` runs `.github/scripts/upstream-sync.sh` every
day at 09:23 UTC; it can also be run by hand from the Actions tab. It keeps one pull
request, `sync/upstream` → `main`, and never merges into `main` itself.

| Upstream state | What the job does |
|---|---|
| Already in `main` | Nothing. An open sync PR is closed. |
| Clean merge | The branch becomes the merge commit. The PR lists the commits and the fast offline checks: catalog, metadata, coverage, counts, spec artifacts, effects manifest, MCP reconciliation and conflict markers. A failing check makes the PR a draft. |
| Conflicts | The branch is upstream's `main`, so GitHub shows the conflicts. The draft PR lists the files and the commands to resolve them locally. |
| Someone pushed resolution commits to `sync/upstream` | The job never resets the branch. It merges new upstream commits on top when that is clean, and otherwise comments on the PR. |

- **Resolving conflicts:** follow the steps below on `sync/upstream`, then push.
- **Before merging the PR:** run the affected contract suites. The PR's checks are
  only the fast offline set.
- **Token:** without a `UPSTREAM_SYNC_TOKEN` secret, the job uses `GITHUB_TOKEN`,
  which has two limits:
  - it cannot push upstream changes to `.github/workflows/` (the job logs this case);
  - PRs it opens do not trigger the fork's other CI.

  A fine-grained token for this repository with Contents, Pull requests and
  Workflows set to read and write removes both limits.
- **Local dry run:**

  ```sh
  GITHUB_REPOSITORY=byrn-baker/netclaw-convergence DRY_RUN=1 bash .github/scripts/upstream-sync.sh
  ```

  Run it in a scratch clone. It checks out a work branch, pushes nothing and calls
  no GitHub API.

## Next upstream update

1. Start from a clean fork checkout; fetch `upstream` and its tags. Record both
   revisions and create a rollback branch and isolated integration worktree.
2. Merge `upstream/main`, preserving its history. Review conflicts against both
   parents. Keep fork behavior in the module/extension files documented in
   `ui/netclaw-visual/FORK-NOTES.md`.
3. Reconcile canonical metadata, skill hashes and reviewed installer effects
   after inspecting source differences. Never refresh a protection hash merely
   to silence a failing check. Regenerate catalogs and verify parity.
4. Run the relevant installer/HUD/Convergence contracts. Use a private checkout,
   `umask 077`, and a Node executable whose ancestors are not group-writable
   for managed-lifecycle tests. Preserve the guards rather than relaxing them.
5. Record any baseline failures separately. Keep live credentials, native
   runtime configuration, operator testbeds, telemetry data and PVCs out of the
   merge and test fixtures.
6. Fast-forward the live checkout only after validation. Publish new frontend
   assets before atomically replacing entrypoints; retain old hashed assets
   for open browser tabs. Restart the HUD backend when its code changes.
7. Verify actual browser navigation, Convergence/IDS data, gateway readiness and
   Argo application health. Push to this fork; upstream contribution is a
   separate review and authorization.
