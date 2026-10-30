# Spec153 Windows/WSL return — 2026-10-24

**Source fixes and available evidence are ready for Mac reconciliation. Windows/WSL qualification is incomplete; this is not a release or merge-readiness declaration.** The owner requested remote delivery and a reusable Mac handoff, and asked that testing not destabilize the shared machine. Additional provisioning and deliberate host restarts were stopped. No accepted Spec Kit decision or original scope was regenerated or reduced.

- Exact accepted Mac baseline: `89627477fb470cd7c293e33e192c5983819d45d4` on `153-ide-installer`.
- Qualification branch: `153-ide-installer-wsl-qualification`, created from that exact baseline in a fresh Linux ext4 checkout. The original dirty checkout was preserved.
- Final tested implementation commit: `cf97be1c286442660c355d50cf0788199a24c2a1`; setup source digest: `92260f4711c8f751ce735f004e990129c98546b68e71641404e77ac226386c7f`.
- Earlier successful wizard/Risk installations bind to `30dbf6a99f676abe6e45b844a700128c84c0cdfb`, digest `b2535298751b1e002815f50b22ee7c3bf95fa7a779ebc5992e5702058522b9ce`; the earlier Ubuntu 26.04 OpenClaw wizard binds to `7080df8d16e72b5c5e03b354dcf487679e3ddefe`.
- The exact evidence/qualification commit and delta-bundle checksum are recorded in `DELIVERY.json`. The subsequent delivery commit adds transport metadata and the bundle; its exact SHA is supplied in the handoff message and is the remote branch tip. Never reuse any recorded approval/run ID.

## Per-host result

**Ubuntu 26.04 WSL2:** both focused harnesses passed actual Windows VS Code remote wizard Tiers 1–3. A three-claw mixed Risk passed required tiers and authenticated hot-member local status. Actual native OpenClaw and Hermes stop/start/restart reruns preserved the neighboring claw's file hashes and PIDs. Installed Codex/Claude registration and the VS Code MCP client used by Copilot passed; pinned deployment Specify smoke passed. The complete post-fix Risk cold-wake rerun is blocked by loss of its volatile fixture; the new isolated native-manager regression passes. CLI installation through its controlling terminal remains unrun here (reviewed CLI cleanup is separately exercised).

**Ubuntu 24.04 WSL2:** the retained disk-full fixture was restored with a verified disk hash. Fresh build and extension tests passed; a new OpenClaw remote wizard passed Tiers 1–3. Hermes completed installation phases but lost its engine during verification; the observed result is unknown, not a pass. Final setup regression includes actual pinned interpreters, Specify, native systemd paths and cold wake. Both new focused runs were subsequently cleaned through fresh controlling-terminal reviews, returning `verified`. Assistant applications were provisioned, but installed-client discovery, a new Risk, focused management and deliberate restart acceptance remain unrun on this host.

**Native Windows:** actual missing/disabled WSL-extension guidance, supported-candidate cancellation, handoff cancellation, UTF-16 output, reviewed private handoff, remote restoration and one-use replay rejection were exercised. Relevant WSL status/list snapshots were unchanged for the read-only/cancel paths. WSL-disabled, WSL1-only, no-distribution, unsupported-distribution and ambiguous/error OS fixtures were unavailable; actual expiry/wrong-host cases remain unrun. Mock coverage is retained as contract coverage only. **The native Windows gate is incomplete.**

## Findings and limits

All findings, including unsuccessful attempts, are in [wsl-findings.md](../specs/153-ide-installer/wsl-findings.md). Fixes cover literal systemd environment/working-directory semantics, Linux process identity, a Linux PTY test, stale wizard run display, private managed Python and collected on-demand units. Seven source commits are included; the last two implement and correct the native cold-wake fix.

The history includes physical disk exhaustion, interrupted installs, a preflight port collision, a lifecycle CLI timeout, an unexplained initial neighbor comparison, a test-driver bus omission, the initial typed-array parsing failure, interop timeouts and fixture stops. Successful reruns do not erase them. [matrix.json](matrix.json) lists each required case and [test-results.json](evidence/test-results.json) distinguishes passes, failures and skips. Optional live tiers 4–6 were unselected throughout. No provider account, real channel or device was used.

The full extension suite retains three explicit skips: installed-native OpenClaw workspace fixture, cached RAG embedding model and macOS native controller on WSL. Actual installer/lifecycle evidence does not silently substitute for those skipped tests. Source-development handoff did not qualify packaged VSIX activation.

The [60-second demonstration](demo/netclaw-setup-60s.mp4) is the separately requested October 18 tour: real UI, synthetic choices, two MCP selections and a mixed Risk **draft**, with native Apply canceled. It is not deployment evidence or the final owner/release recording.

## Return and privacy

Read [RETURN-TO-MAC.md](RETURN-TO-MAC.md) and [matrix.json](matrix.json). T081, T082 and T084 remain unchecked, with 81/84 original tasks checked. The Mac agent must rerun affected regressions and reconcile outstanding real-host gates before claiming cross-platform readiness or integrating into main. The user's earlier PR/merge/branch-cleanup request is deferred to that stage by the later explicit handoff instruction. No release package, Marketplace upload or publication was performed.

Only allowlisted reports, hashes, synthetic comparison summaries and inspected demo artifacts are included. Raw logs, runtime homes, testbeds, credentials, native registrations, journals, editor state and the preserved VHD remain local. [privacy-audit.json](evidence/privacy-audit.json) states the export scan's scope and limitations.
