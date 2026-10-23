# FastMCP 4 migration (spec 141)

The branch `141-fastmcp-stateless-upgrade` upgrades the 35 repository-owned FastMCP
servers to **FastMCP 4.0.11 / MCP Python SDK 2.3.0**. These were the latest stable
PyPI versions checked on 2026-10-04. The full fleet migration remains **open**:
five external integrations still require a separate source port or replacement
choice, and RADKit requires its licensed dependency. See
[verification and exceptions](../specs/141-fastmcp-stateless-upgrade/verification.md).

## Runtime behavior

| Capability | Adoption |
| --- | --- |
| Modern protocol `2026-07-28` | Real client discovery verified alongside legacy negotiation. |
| Sessionless HTTP | Dot explicitly uses `http_app(stateless_http=True)`; UML's HTTP launcher does likewise. Modern requests carry protocol metadata and do not require MCP session IDs. |
| Stdio | Existing transport defaults remain. Legacy clients can still negotiate their supported protocol. |
| Structured outputs and schemas | Framework-generated output schemas, tool titles, and stricter unknown-argument handling are accepted. Existing tool names and arguments remain. |
| Context and lifespan | External Infrahub and Itential use public lifespan context access; application caches and persistent stores remain application-owned. |
| Validation and errors | Real malformed requests are rejected before fixture tool execution. CML exception construction uses the SDK2 API. |
| Authentication | Existing bearer/OAuth, Host/Origin checks, read-only settings, and change-control gates remain authoritative. |
| Tasks | Selectively enabled under spec 142; see [Tasks guide](MCP-TASKS.md). |
| Automatic caching/retries, code mode, distributed storage | Not globally enabled. These change persistence, side effects or exposed capabilities. |
| Horizontal deployment | Sessionless transport alone does not make local SQLite/files, collectors, GAIT state, or application sessions safe across replicas. |

Claroty's previously untyped `Any` fields now advertise unrestricted JSON rather
than the SDK1-generated `string` schema. That matches their existing documented
acceptance of numeric IDs and list-valued filters; application functions were not
changed. Other baseline-available input contracts match after ignoring descriptive
schema metadata and the new `additionalProperties: false` restriction.

## Installation and source ownership

Use the normal component installer. Modern components have exact framework bounds
in `config/python-components/`; the legacy shared constraints remain for low-level
SDK1 integrations. Python 3.12 is the dependency-resolution baseline; individual
components may impose stronger requirements than FastMCP's Python 3.10 minimum.

External Git repositories are not vendored into this branch. Their reviewed
revision, source hashes, and compatibility edits live in
`config/fastmcp-external-patches.json`. Fresh clones use the reviewed commit.
Existing clones are retained without pulling over local edits. Before installation,
`apply-fastmcp-patches.py` verifies all affected files, accepts already-applied
patches, and refuses unknown revisions or operator edits. A write failure rolls
back files written by that invocation. This is not a filesystem-wide transaction
and does not protect against concurrent source editing; stop editing during upgrade.

Lantronix and FWRule install from reviewed project metadata rather than upstream
locks that still select FastMCP3. CVP diagnostics use stderr. Infrahub, Prometheus,
CML, and Itential use reviewed source installs instead of unconstrained package
fallbacks. AWS Network's uvx command pins both framework versions and the tested
application release. NSO and Infoblox also pin their tested application releases.

GAIT builds a candidate runtime, bundles its matching patched source, checks its
catalog, and only then promotes the interpreter. `gait-stdio.py` prefers that
runtime even if host Python can import an older GAIT. A retained `.previous`
runtime prevents silent replacement of the recovery point.

## Upgrade and rollback procedure

This branch has not deployed, restarted services, or changed operator environments.
Before deploying, stop affected servers and retain the previous Git checkout,
external source directories, runtime records/configuration, and dedicated `.venv`
directories. Keep application data and audit stores in place. Build and validate a
separate release checkout. General pip component installs are not transactional:
do not treat their success as proof that live credentials and vendor APIs work.

1. Resolve dependencies and check source patches in the separate checkout.
2. Install selected components into isolated runtimes; retain the previous runtime
   paths. Dedicated `.venv` paths need an explicit retained copy before replacement.
3. Run catalog and fixture tests, then approved read-only vendor checks using the
   intended operational credentials. No catalog probe in this branch does that.
4. Switch managed launch configuration only after validation passes. Existing custom
   launch entries are preserved by the installer and may need explicit reconciliation.
5. On failure, restore the prior source **and** interpreter/configuration together.
   Never downgrade a shared environment in place. For GAIT specifically:
   `python3 scripts/setup-gait-runtime.py --restore --target <runtime-path>` restores
   the retained runtime and its bundled source; the replacement generation is retained.

## Reproducing verification

```sh
python3 scripts/check-fastmcp-compat.py
python3 scripts/check-dependency-pins.py
python3 scripts/verify-spec-artifacts.py
python3 scripts/run-contract-tests.py --suite fastmcp
```

Install each owned requirements/pyproject manifest in its own environment under
the checked-in bounds. The catalog runner accepts a dependency-complete interpreter:

```sh
python3 scripts/check-fastmcp-compat.py --python /path/to/venv/bin/python \
  --catalogs /tmp/owned-catalogs.json
```

For external sources, create disposable copies at the manifest's reviewed commits
under `/tmp/review/mcp-servers/<directory>`, and apply each component patch:

```sh
python3 scripts/apply-fastmcp-patches.py --root /tmp/review --component cml --check
python3 scripts/apply-fastmcp-patches.py --root /tmp/review --component cml
python3 scripts/check-fastmcp-external.py --sources /tmp/review/mcp-servers \
  --python /path/to/dependency-complete/bin/python --output /tmp/external-catalogs.json
```

The external runner rejects outbound socket connections, uses disposable HOME and
fixture credentials, and invokes no vendor tools. CML's eager vendor-client
constructor is replaced with a fixture for discovery; its framework is real.
RADKit produces an honest failure until its licensed client is installed.
A catalog pass is not proof of vendor authentication, application tool execution,
or all HTTP authorization paths.
