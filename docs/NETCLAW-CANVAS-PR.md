# Canvas terminal integration — PR scope and validation

Draft contribution: [spec131](../specs/131-canvas-terminal-workflows/spec.md),
[adoption plan](../specs/131-canvas-terminal-workflows/plan.md), and
[verification](../specs/131-canvas-terminal-workflows/verification.md).
Implementation preceded these artifacts; maintainer scope/policy approval and
Linux validation are required before this draft is ready to merge.

This branch integrates the browser-based terminal workflow into NetClaw's
existing Canvas. It is based on upstream `40425bb` and preserves the current
Chat dashboard, classic view, assessment/session integration and loopback-only
HTTP/WebSocket access controls.

## Included

- Interactive SSH terminal, explicit host-key trust and per-device legacy KEX
  opt-in; terminal selection can branch into Canvas conversations.
- Testbed add/edit/remove flows, revision checks, backups and active-session guards.
- Validated structured artifacts, offline pyATS/Genie JSON parsing and an isolated
  runtime installer with a Windows-to-WSL launcher.
- English intent, live execution evidence, and explicit Local/Lab change-control
  settings. Production controls and collector read-only scopes remain intact.
- Opt-in topology collection, identifier correlation, closest-device evidence,
  contained hover/side panels, topology-image mapping and sharing.
- Clearly labeled synthetic NetBox/ServiceNow examples; opt-in Infoblox,
  ThousandEyes, Kubernetes and OTLP integration groundwork. VMware/ExtraHop
  integrations remain planned, not implemented.
- Windows scripts for the web frontend/API/gateway, supporting docs and tests.
  These are web-service launchers, not a packaged desktop application.

## Excluded

- The Electron/standalone JackRabbit Terminal application and its commit history.
- Personal testbed inventory, credentials, local `.env` files, collected device
  observations, topology uploads, local grants/host-key stores and session logs.
- Built distributions and `node_modules`.

Regression examples use synthetic labels and documentation IP ranges rather
than copying the operator's lab topology. No devices are automatically authorized.

## Reproduce validation

From `ui/netclaw-visual`:

```sh
npm ci --ignore-scripts
npm run build
npm run test:canvas
npm test
```

From the repository root with Python available:

```sh
python scripts/test-install-pyats-genie.py
python ui/netclaw-visual/test/genie_adapter_test.py
```

Build, Canvas mock/synthetic suites and Python tests were exercised on Windows
with Node 24.18.0. The upstream suite reports 255 passes and 15 failures on this
host; the same 15 failures reproduce on unmodified upstream `40425bb` using the
same dependencies. They involve POSIX permission assertions, symlink privileges,
and a dashboard test's URL-to-filesystem conversion. They have not been bypassed
or reported as passing. Linux validation is still required before merge.

The optimization pass includes a synthetic browser smoke check of terminal,
route context and Genie view loading, not full visual acceptance. There is no
claim of live-router, live-provider or model-backed VPN execution. Installer tests
mock package operations; actual pyATS installation remains unverified here
because the host's WSL runtime cannot start. Existing upstream private-directory
checks also limit Windows HUD session binding; this PR does not weaken them.

The current GUI/API remains a loopback application, not a multi-user RBAC service.
Review the feature-specific documents under `ui/netclaw-visual` for authorization,
data-retention, provider scope and topology-image sharing limitations.
