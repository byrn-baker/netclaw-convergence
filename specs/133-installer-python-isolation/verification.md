# Verification

Date: 2026-10-01. No device changes or credentialed service calls were made.

## Passing checks

- `python3 -m pytest -q tests/unit/test_installer*.py tests/unit/test_core_deploy_preservation.py tests/unit/test_jev_installer.py`: 49 passed.
- `python3 scripts/run-contract-tests.py --suite unit --prepare`: PASS, broad offline unit suite.
- `python3 scripts/run-contract-tests.py --suite reconcile --prepare`: PASS.
- `python3 scripts/run-contract-tests.py --suite installer --prepare`: PASS, fresh isolated dependencies and MCP initialization/tool discovery. The suite is included in the CI manifest.
- `python3 scripts/verify-spec-artifacts.py`: PASS, 119 specs and four legacy exceptions.
- `python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability`: all six surfaces PASS.
- `python3 scripts/run-contract-tests.py --list` and `--matrix`: manifest parity and CI discovery PASS.
- Bash syntax and `git diff --check`: PASS.
- Installed OpenClaw 2026.9.7 accepted a temporary generated configuration with `openclaw config validate`. Missing credential/endpoint warnings were expected; no live configuration was replaced.

## Fresh runtime evidence

Used protected system Python 3.13 as the base interpreter. Automatic component environments installed dependencies without system-package overrides. Generated launch commands ran from a separate temporary working directory. Only MCP initialize and tools/list were called, using fixture localhost endpoints.

| Component | Dependency installation | MCP tool discovery |
| --- | --- | --- |
| BGP Intelligence | PASS | 10 tools |
| gNMI | PASS | 10 tools |
| Nautobot | PASS | 59 tools |
| SuzieQ | PASS | 5 tools |
| Firewall Rule Analyzer | PASS | 4 tools |

The first gNMI startup exposed an unsupported FastMCP constructor keyword; it was fixed and discovery rerun successfully. Initial broader unit checks found deployment-fixture and interactive-output regressions; both were corrected before the passing rerun.

## Boundaries

Other integrations were not all freshly installed. The external firewall checkout is optional in fresh CI; the smoke suite reports BLOCKED_DEPENDENCY for that portion when absent. Credentialed endpoints, device operations, every OS/Python combination, and a live Hermes deployment are untested. Existing Hermes MCP configuration continues to require the translator's explicit sidecar merge. The live OpenClaw gateway and operator configuration were not changed by validation.

GAIT was unavailable at the initial inspection; a local development audit was recorded after the unit runtime supplied its CLI. This is a late audit, not a claim that startup protocol occurred retroactively.

## Publication

Initial HTTPS push authentication was unavailable. SSH subsequently authenticated and pushed the branch; the operator opened [PR #279](https://github.com/automateyournetwork/netclaw/pull/279). Remote CI is distinct from the local checks above.

## Follow-up: 34-component operator run

The larger selection exposed three additional failures. UML upstream 1.4 requires
MCP2/FastMCP4, incompatible with legacy shared bounds. Its component-specific
bounds now select a separate environment rather than modifying the failed legacy
runtime. Memory MCP lacked Hatch wheel file selection; its wheel now includes
the top-level module, storage package, SQLite schema and embedding package.
MemPalace 3.10 moved the server file into a package; verification and skill launch
now use the stable module path and installed interpreter.

Measured local MCP initialize/tools-list: UML 5 tools, Memory MCP 10 tools,
MemPalace 47 tools. UML dependencies were freshly installed. Memory was tested
from its built wheel with existing contract dependencies; a fresh download of
all Torch/embedding dependencies and semantic model operations was not tested.
MemPalace used the interpreter installed by the operator's run, with a temporary
palace path. No network/service tools were invoked.

PR publication was subsequently completed by the operator as #279. Follow-up
commits are pushed to its existing branch through SSH.

Follow-up checks: 52 targeted tests passed; installer smoke suite (including actual Memory wheel build) and all six declaration reconciliation surfaces passed.
