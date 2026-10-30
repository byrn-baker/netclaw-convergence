# Keeping Convergence aligned with NetClaw

Convergence extends `automateyournetwork/netclaw`. Merge upstream history into
this fork; do not replace upstream features with a separate implementation.
The fork's live OpenClaw configuration is not the repository's installer template.

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
