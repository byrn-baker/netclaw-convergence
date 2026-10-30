# Spec160 release verification — 2026-10-30

The owner explicitly authorized the versioned source/extension release, commit,
push, PR, merge, completed-branch cleanup and return to main. This supersedes the
implementation-only publication hold. Source **1.14.0** and extension **1.4.0**
are the coordinated feature increments; no second bump is made for release prep.
Existing installations and network/provider operations remain outside this release.

## Evidence and gates

Implementation commits `46441f7`, `f982300` and `09d9a21` contain the specification,
implementation and completed 30-task evidence. [Verification](verification.md)
retains the exact automated, actual MCP, terminal and native Mac Insiders results.
Live tenants/devices, Windows/WSL and stable/minimum-editor visual qualification
remain unverified. Publication does not change those results.

Release preparation adds the README announcement, a copyable community note,
tag-pinned release links and extension guidance. Two original companion articles
are staged as `draft: true` in the separate `modern_website` repository; this
release does not publish that website or send social/Slack messages.

Before release: validate release metadata, all spec artifacts and six declaration
reconciliation surfaces; verify the clean committed VSIX, exact source provenance,
required bundled assets and extension dependency audit. Applicable PR workflows,
merged-main workflows and the version tag check must pass. No failing check may
be bypassed. Marketplace publication uses the verified archive; the downloaded
public version must match it before publication is reported complete.

Final source commit, PR/CI, tag, package digest and publication receipts are retained
in release assets and local memory/GAIT so this tested source/package stays immutable.

Release preparation caught a strict TypeScript error missed by the earlier esbuild
bundle: `DraftChange.value` is unknown, so capability invalidation must narrow the
object and its component array before inspection. The release fixes that type and
runtime boundary and repeats the extension check/suite before packaging.

Six release-helper tests and 143 spec artifact records pass. All six declaration
surfaces pass in a clean committed worktree. The owner's original working checkout
also contains an untracked HumanRail clone whose upstream `mcp>=1.0.0` declaration
triggers the local dependency scan; it is not part of this release. The managed
installer already pins MCP 2.3.0 and has reviewed external patches. That clone was
not edited, and no claim is made that its installed runtime has been repaired.
Extension audit meets the high-severity gate with one reported moderate `qs`
advisory (GHSA-6pq8-jhm2-2vcw); publisher credential verification succeeds.

Strict TypeScript checking and all four focused dynamic-testbed controller tests
pass after the narrowing fix. The repeated local full suite reports 144 passes,
three existing skips and three host-blocked failures: two fixtures invoke
`/usr/bin/git` and the Hermes launcher fixture invokes `/usr/bin/python3`; all hit
this Mac's newly pending Xcode license agreement. The latter is confirmed in its
private synthetic HUD log. The earlier qualified full run remains recorded in
verification.md. No license was accepted and no test/security boundary was weakened.
Release requires the full Ubuntu CI suite on the final source to pass; these Mac
failures are not relabeled as successes. Task commands use the separately installed
Command Line Tools through a process-local developer-directory selection.

The first catalog CI run exposed a test assumption: native Ubuntu is deliberately
unsupported by the new-claw host gate (macOS / qualified Ubuntu WSL2). The real PTY
test now checks that unsupported hosts refuse without saving a draft, while still
exercising selected-runtime `setup.sh` prompts there. Supported hosts retain the
complete new-plan prompt/readback assertions; no production host gate changed.
Packaging also detected stale local `node_modules` (Zod 4.2.0 versus locked 4.6.7).
`npm ci` restored the exact locked dependencies before producing the verified VSIX.
