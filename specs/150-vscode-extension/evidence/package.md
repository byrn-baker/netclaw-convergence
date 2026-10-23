# Historical original package evidence

For the final implementation candidate, use [mac-final.md](mac-final.md) and
`../artifacts/mac-final-package.json`. Prior artifacts below remain preserved.
Publication is explicitly held by the owner.

# Original Mac candidate

Built from clean source commit `8db2c2144e169f4c2ab832d3d62c40f1b1c6a807`.
Publisher/name/version: `NetClaw.netclaw` / `0.1.0`.
Artifact committed at `specs/150-vscode-extension/artifacts/netclaw-0.1.0.vsix`.
SHA-256: `71694842db407dbb28ed695a31ca583a892d2c2bc0903c04829514b123fec005`.
Size: 2,220,783 bytes. 24 ZIP entries; 5,726,611 uncompressed bytes.

Allowlist review found only manifest, README/privacy/changelog/license, bundled
extension/stdio/webview code and local branding/Avatar resources. No `.env`, runtime
home, session record, credentials, tests, source directory or node_modules is in
the VSIX. React/Three/SDK bundled license notices are included. It contains no
native addon or platform-specific runtime installation.

## Actual installed lifecycle

VS Code **1.141.0**, macOS arm64, isolated user/extensions directories:

1. Installed a synthetic older `0.0.0` package with the same implementation to
   exercise the genuine editor upgrade mechanism. Created/bound a fixture profile.
2. Upgraded to the exact `0.1.0` candidate; profile identity retained, no auto-connect.
3. Launched with the extension disabled; its command could not run.
4. Re-enabled; same saved profile could connect to unchanged HUD.
5. Uninstalled; actual extension inventory no longer contained NetClaw.
6. HUD stayed reachable; configuration and environment bytes unchanged. Zero
   gateway/provider/device calls during lifecycle.

Private report: `netclaw150-vsix-lifecycle-jQPiFN/report.json` in the Mac temporary
directory. The 1.102 lifecycle passed install/upgrade/disable/re-enable; its uninstall
CLI exited with a V8 error after removal. A subsequent uninstall reported not
installed and list-extensions was empty. That CLI process result is recorded as
an anomaly, not a clean minimum-version full-lifecycle pass. The complete 1.141
run passed without the anomaly.

Marketplace authentication was reverified for `NetClaw` on this Mac. No token was
read or exported. **Not published**: real Windows/WSL and interactive assistant
acceptance still gate release. Prior expanded-branch packages are superseded.
