# Return to the Mac agent

Continue the existing Spec153; do not restart Spec Kit or regenerate accepted decisions. Read this folder's SUMMARY, DELIVERY, environment, matrix, test-results and privacy-audit, then `specs/153-ide-installer/{MAC-COMPLETION,WSL-HANDOFF,RECORDING-AND-RETURN,spec,plan,tasks,analysis,verification,wsl-findings}.md`. Follow repository startup/audit instructions without contacting live devices.

## Reconcile source safely

Fetch `origin/153-ide-installer-wsl-qualification` and verify the exact tip supplied in the handoff message. Verify ancestry from Mac baseline `89627477fb470cd7c293e33e192c5983819d45d4`. Preserve any dirty Mac checkout; use a fresh checkout/worktree if necessary. Review the seven implementation commits and the subsequent sanitized evidence commits. Do not overlay an archive, reset owner edits or reuse WSL/Mac native approvals. The Git bundle is an alternative transport with the accepted Mac baseline as its prerequisite, not an overlay.

The original main base is `45a333ed18b75643c2d1589eb884be7b303817c1`; fetch current remote state rather than assuming it remains current. Source plans bind to their actual checkout/hash, so create new Mac plans and reviews after reconciliation.

## Affected Mac checks

1. Fresh qualified dependencies, TypeScript check/build, complete setup suite with pinned opt-ins, complete extension suite with each skip named, installer selection and catalog checks. Reuse accepted platform-independent Mac evidence where no delta affects it.
2. Actual controlling-terminal cancellation and surviving-writer behavior after the Linux fixture's SIGHUP adjustment.
3. Process identity/ownership/refusal and focused multiclaw lifecycle on Mac: Linux uses boot ID/start ticks, while existing Mac/legacy comparisons must remain conservative. Recheck selected/foreign native service scope.
4. A fresh Hermes focused install with managed Python retained inside its home; exact Tiers 1–3 and neighbor preservation. This environment change applies to independent homes on Mac too.
5. A second wizard plan's native Review/Apply, cancellation and explicit Resume: no stale prior-run label and no lost recovery reference.
6. Native on-demand wake and repeat-wake idempotence on Mac, even though the new absence/post-start branch is WSL-only. Recheck cleanup and ownership after management.

## Outstanding Windows/WSL cases

Do not mark T081/T082 complete from this handoff. Complete or obtain an explicit owner decision on the open cases in matrix.json without disguising a scope exception as a pass. Remaining actual OS variants need suitable disposable Windows hosts; Mac tests and mocked `wsl.exe` output cannot qualify them.

- Ubuntu 24.04: fresh complete Hermes wizard, installed CLI/Codex/Claude/Copilot discovery, mixed Risk, selected management/neighbor preservation, deliberate restart/disconnect restoration. The interrupted Hermes fixture was cleaned after retaining its unknown outcome; it cannot be resumed as a successful run.
- Ubuntu 26.04: actual legacy CLI install, full mixed Risk cold wake after the fix, and controlled restart/disconnect recovery. The RAM-based Risk completed installation but its mount vanished when the fixture stopped. A replacement must use a sufficiently provisioned durable disk or a deliberately maintained disposable session; do not assume systemd keeps WSL alive.
- Native Windows: real WSL-disabled, WSL1-only, no-distro, unsupported-distro, ambiguous/error detection, expiry and wrong-host rejection; packaged handoff activation remains a later packaging gate.

Reproduce the cold-wake defect with an inactive, exactly owned on-demand federation service: systemctl show can load its definition, then GetUnit reports it absent after collection. On final source, exact-name ListUnitsByPatterns must prove absence, start must remain scoped to the owned definition, and loaded typed argv must verify afterward. `NETCLAW_SETUP_SYSTEMD=1` on a disposable WSL account runs the native special-path and cold-wake tests in `test_setup_systemd.py` and `test_setup_member_start.py`. Never set this opt-in on the owner's normal account merely to fill a row.

The native test's initial candidate failed because method replies wrap the returned array in an argument array (`data: [[]]` for absence). Both malformed/failed listings and changed post-start argv now refuse. Keep those adversarial checks. Full live-Risk rerun remains explicitly open despite isolated native tests passing.

## Close and integrate only after readiness

Reconcile analysis, verification and tasks with actual results. Leave unsupported/optional dispositions visible. Complete T084 and the milestone draft only after the cross-platform evidence supports it. The user authorized commit/push/PR/merge/completed-branch cleanup and returning to main, then explicitly asked this WSL stage to send work back to Mac first. Carry out integration there after required checks and blockers are resolved; do not delete incomplete branches or force through required checks.

Packaging readiness, the owner's walkthrough and the final recording follow cross-platform readiness per RECORDING-AND-RETURN.md. The included draft tour does not replace them. Marketplace/release publication still requires its own authorization. Keep private journals and raw state local; do not upload them to finish the evidence list.
