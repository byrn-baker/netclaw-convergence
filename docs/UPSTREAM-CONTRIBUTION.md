# Convergence upstream contribution

The fork's `main` is the working integration branch. It includes the upstream
v1.14.0 baseline (`b18d51c0`) and the Convergence/Guardian additions, including
the portable model-provider configuration and IDS replay optimization. See the
[30 October synchronization record](runbooks/upstream-sync.md). Runtime credentials, OAuth sessions,
private member environments and database contents stay outside Git.

## Proposed contribution path

Start a design-only draft from upstream `main`, following upstream's required
maintainer scope review. The draft proposes an optional Convergence monitoring
workspace, durable cases, bounded read-only investigations, operator feedback,
and a future IDS sensor interface. It does not represent the fork's entire
history as an upstream-ready implementation.

After agreement, port focused changes with sanitized fixtures and installation
coverage. The implementation sequence should be:

1. Durable incident/case contracts, authenticated ingestion and failure tests.
2. Read-only investigation tools, case MCP and installer/runtime integration.
3. Optional HUD workspace using upstream navigation and access controls.
4. Telemetry adapters and deployment examples without installation-specific data.
5. Versioned feedback and retrieval with reliable recovery from failed indexing.
6. Separately reviewed IDS ingestion, asset/zone correlation and response policy.

Keep unrelated personality changes, additional MCP vendors, local models,
generated site configuration, runtime state and historical fork specs out of
each implementation PR. Preserve attribution for code selected from this fork.

## Checks at synchronization, 24 October 2026

- HUD unit suite: 380 tests passed.
- Convergence hardening: receiver/API regressions, contract tests, Prometheus
  disappearance rule, browser Security view and live synthetic alert lifecycle
  verified during the implementation session. Three contract tests were skipped.
- Guardian: nine MCP initializations and a native model permission check passed.
- Convergence API: Node 24 image healthy; bcrypt 5 hash compatibility verified
  with bcrypt 6; production npm audit reported zero known vulnerabilities.
- Unpushed history: no exact matches for 29 configured credential values. The
  three private-key marker candidates were test files already in upstream main.
  This targeted check is not an exhaustive secret or history audit.
- Fork-wide spec checker: **46 findings** in existing fork artifacts. These
  remain documented debt, not an upstream acceptance pass.
- `config/openclaw.json` is the repository's legacy integration template. Passing
  it directly to the current native gateway validator reports legacy fields
  (`mcpServers`, `security.mode`, `commands.ownerDisplay` and a comment key).
  Installed runtime configs are separate; both live gateway/member configs
  validated during hardening. Upstream installation parity needs its own test.

## Remaining acceptance work

Maintainer scope agreement and a coordinated specification number are pending.
The implementation port needs artifact/declaration reconciliation, fresh-install
and upgrade coverage, restricted backend/HUD access, a transactional learning
handoff, restoration exercises and explicit sensor coverage tests. Current
firewall activity is useful evidence; it does not establish IDS capability.
