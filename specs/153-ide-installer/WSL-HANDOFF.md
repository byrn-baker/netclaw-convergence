# Spec153 WSL smoke and platform-difference handoff

**READY FOR WINDOWS/WSL SMOKE — MAC GATE PASSED.** All eight fixed Mac groups passed on 2026-10-18; see [MAC-COMPLETION.md](MAC-COMPLETION.md). The owner then authorized committing and pushing the completed source to `origin/153-ide-installer`. Use the exact Mac baseline commit supplied in the handoff message. A checkout of that commit contains the full implementation and sanitized evidence; no archive overlay is needed. The earlier `spec153-wsl-20261018.tar.gz` remains obsolete. The later Mac-complete archive is a historical fallback, not an overlay to apply on top of this Git checkout.

Continue the existing feature; do not restart Spec Kit or regenerate its decisions. Git base: `45a333ed18b75643c2d1589eb884be7b303817c1`; feature: `153-ide-installer`. Read `spec.md`, `plan.md`, `tasks.md`, `analysis.md` and `verification.md` in this folder. The original input documents are preserved under `inputs/`.

This is a source-development qualification handoff, not a release or evidence that all acceptance has passed. Follow the current unchecked tasks. The owner replaced the five-person study with synthetic engineering checks and organic feedback. Human walkthrough, packaging readiness and recording follow the return to Mac. Windows qualification covers smoke and platform-specific behavior; it does not reopen platform-independent feature acceptance already completed on Mac.

## Git checkout and qualification branch

Repository: `https://github.com/automateyournetwork/netclaw.git`. Fetch `origin/153-ide-installer` into a fresh checkout on the WSL Linux filesystem under your home, not `/mnt/c`. Verify the exact Mac baseline SHA supplied by the Mac agent and create `153-ide-installer-wsl-qualification` from that commit. Record the baseline SHA before changing files. Do not reset, clean or overwrite an existing dirty checkout; use a separate directory/worktree if needed.

The original pre-feature base was `45a333ed18b75643c2d1589eb884be7b303817c1`; it is historical context, not the WSL starting revision. The pushed Mac baseline includes the previously modified/untracked implementation and reviewed Spec153 additions to repository instructions. Private GAIT history, daily memory, installed runtime homes, credentials, generated dependencies, editor storage and service definitions are excluded. Build dependencies afresh. Generate NEW host/source-bound plans and native reviews. Never reuse a Mac run ID or approval.

The archive importer is only for the older exact-base archive workflow. Do not run it over the pushed feature checkout. Preserve the Git baseline and final qualification commits for the return to Mac.

## Required hosts

- Windows desktop VS Code >=1.109 with the Microsoft WSL extension. Keep the native Windows gate window separate from the WSL extension development window.
- WSL2 Ubuntu 24.04 and 26.04, each a disposable distribution or VM snapshot. Record the actual Windows build, WSL/kernel, distribution, architecture, VS Code and extension host versions.
- A working systemd user manager in each distribution, including `systemctl --user` and `busctl --user`. Record missing user-bus/systemd prerequisites as blocked; binary presence is not readiness.
- A Node version satisfying both checked-in runtime policies, plus Git, uv and Python >=3.10 for the engine. Node 24.19.0 was used on Mac. The engine provisions isolated Python 3.12 and the pinned Hermes Python 3.14 companion itself.

The Windows VS Code application hosts the UI; the extension/runtime under test must execute in WSL. Microsoft recommends keeping Linux workloads on the Linux filesystem. systemd services alone do not keep a WSL instance alive; explicitly test shutdown/restart and restored readiness. Sources: [VS Code WSL](https://code.visualstudio.com/docs/remote/wsl), [WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems), [WSL systemd](https://learn.microsoft.com/en-us/windows/wsl/systemd).

## Baseline checks

Use an isolated test interpreter with `jsonschema`, PyYAML, pytest, pytest-subtests and cryptography. Record exact versions; do not install into the system Python. From repository root:

```bash
python -m unittest discover -s tests -p 'test_setup_*.py'
python -m pytest tests/unit/test_installer_*.py tests/unit/test_hermes_hud_installer.py tests/unit/test_n2n_install_preservation.py tests/unit/test_jev_installer.py -q
python scripts/check-catalog-metadata.py
python scripts/build-catalog.py --check
python scripts/verify-catalog-coverage.py
```

From `extensions/netclaw-vscode`, with the qualified Node on PATH:

```bash
npm ci
npm run check
npm run build
npm test
```

Read each opt-in test's prerequisites. Provision isolated fixtures for Specify 0.7.1, pinned certificate and MCP interpreters, native OpenClaw and cached embedding models where needed. Record every skip and its reason; a green process with skips is not total coverage. The Mac `preview-setup.mjs` currently uses a local disposable-editor fixture; do not assume it launches a Windows/WSL remote window unchanged. Use the extension development launch workflow in the correct host and record the host identity.

For an additional actual-engine smoke test, `python specs/153-ide-installer/tools/qualify-local-runtime.py --run-disposable-test --harness openclaw` (then `hermes`) creates a fresh temporary runtime, installs pinned dependencies and starts uniquely named native services. It uses synthetic native review and no provider turn; it is not W01/W02 wizard/client acceptance. The account's normal setup journal/lock root and native service directory receive owned records. Retain the printed private result locally, export only redacted reports, and exercise reviewed cleanup of that specific run afterward. The same driver must be qualified on WSL; its Mac counterpart produced the recorded native evidence.

## Smoke and platform-difference matrix — after the Mac gate

Execute the following on both declared Ubuntu distributions. Record PASS/FAIL/BLOCKED/NOT RUN, exact environment, source digest and evidence. Reuse Mac evidence for platform-independent catalog, schema, intent, plan, report and general accessibility behavior. A failure or discovered Windows difference justifies a focused rerun and fix, not a new feature or an automatic full product requalification.

| ID | Windows/WSL-specific exercise |
| --- | --- |
| W01 | Windows VS Code remotely hosts the extension in WSL; new focused OpenClaw and Hermes wizard smoke reaches Tiers 1–3. Correct Linux paths/source identity and native prompts. |
| W02 | CLI, assistant registration/discovery for the three supported clients, and preset smoke in the remote host. Verify Windows versus Linux executable/path separation and private socket access. Reuse Mac intent/plan matrices. |
| W03 | Same/mixed harness multiclaw and a small mixed Risk smoke; per-claw identity, scoped configuration, secret separation and authenticated local member status survive Linux service integration. Reuse the complete four-pair semantic Mac evidence unless a delta fails. |
| W04 | systemd user install/start/stop/restart/on-demand/cleanup with typed ownership observations, special characters, missing user bus and foreign unit refusal. Host shutdown/restart and editor disconnect preserve truthful recovery. |
| W05 | Windows-to-WSL native gate/handoff matrix below, including distribution/version/extension failures, UTF-16, explicit review, expiry/replay and non-secret choice restoration. |
| W06 | Linux-only component dispositions and filesystem/permissions/process differences; do not invoke unqualified global installers. Scoped cleanup and neighbor preservation. |
| W07 | Build/test regressions, remote-window keyboard/layout smoke, redacted exports and source-delta review. Fix every discovered platform defect and rerun affected checks. |

Optional live provider/channel/device tiers remain optional and require designated resources and native consent. Never borrow the owner's resources to fill a smoke-test row.

## Native Windows gate — separate evidence

Test WSL disabled, WSL1-only, no distribution, unsupported distribution, missing/disabled WSL extension, ambiguous/error detection and supported WSL2 candidate. Snapshot relevant state before and after: the read-only gate must not start a distribution, elevate, install or change Windows features. Separately review and test explicit handoff: only disclosed private handoff state/VS Code Server setup may change. Exercise cancellation, expiry, replay, wrong host and UTF-16 detection. A passing mocked `wsl.exe` matrix does not qualify the actual Windows gate.

## Return to the Mac agent

Return a sanitized `spec153-wsl-return/` containing:

1. `SUMMARY.md`: per-host conclusion, remaining blockers, exact failed/skipped cases, source snapshot hash, final qualification commit(s), and whether the Windows gate is complete. Final publication readiness is decided after the Mac return. Never use an unqualified “100%.”
2. `environment.json`: version/build/architecture facts, extension-host kind and service-manager observations; no account names or private paths.
3. `matrix.json`: all IDs above plus native Windows cases; status, evidence paths, execution type (synthetic/owner/controlled/live), timestamps and issue/fix reference.
4. `changes.patch` and any added source files, OR a local Git bundle containing the qualification branch and its commits. State the exact pushed Mac baseline and final qualification SHA so the Mac agent can reconcile without replacing owner edits. Commit only source, fixes and sanitized evidence; keep private test state local. No push is required by this handoff.
5. Sanitized test summaries, screenshots and default redacted Claw Reports. Keep raw logs, runtime homes, provider transcripts, credentials, tokens, keys, testbeds and private journals on the test machine. Record hashes or alias-based comparisons for preservation evidence.
6. `RETURN-TO-MAC.md`: reproduce failures, apply changes, rerun impacted Mac/WSL tests, reconcile tasks/analysis, close remaining release gates and rehearse recording.

Before returning, verify changed file hashes, inspect the diff and scan exports for seeded secrets and real private data. Report the scan's scope and limitations. No publish, Marketplace upload, release package, merge or external messaging from this handoff.

Paste this instruction into the WSL build agent:

> Continue Spec153 from the exact pushed Mac baseline commit and this WSL-HANDOFF.md. Follow the existing SDD artifacts; do not start a new specification. The fixed Mac gate has passed; verify the Mac baseline SHA and create the WSL qualification branch, then run the defined Ubuntu 24.04/26.04 WSL2 smoke and platform-difference checks plus the native Windows gate. Reuse completed platform-independent Mac evidence, fix findings, and return the source delta and sanitized evidence in the defined contract to the Mac agent. Preserve existing claws. The owner approved synthetic/owner usability instead of recruited testers. Live resources still require designation and native consent. Do not publish; hand back for final Mac regression, release review and recording.
