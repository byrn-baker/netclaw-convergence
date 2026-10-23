# Verification evidence

Base: upstream `40425bb`; Node 24.18.0, Windows. Rechecked upstream by fetch when
preparing this draft. No newer main commits existed at that check.

## Existing optimization evidence (2026-09-28)

- PASS: `npm run test:canvas` — 27/27 suites, synthetic/mock data only.
- PASS: `npm run test:bundle` — production build, initial static JS 339,917 bytes
  vs 872,406-byte baseline; seven saved-session regression tests also pass.
- FAIL (known baseline): `npm test` — 255 pass / 15 fail on Windows; same failures
  on unchanged upstream. POSIX permissions/symlinks and dashboard URL-path handling.
- PASS: browser synthetic terminal preview loads, route context opens and Genie
  view opens. Not proof of live gateway, provider, device or parser success.
- PASS from contribution assembly: 10 Python installer mocks and one Genie adapter
  test; rerun results for PR preparation will be recorded below.

## Outstanding

Linux test run/CI, actual pyATS installation (WSL unavailable here), model-backed
execution, live provider acceptance, fleet scale and maintainer policy review.
No security check was bypassed. No production/testbed credentials are sent to CI.

## PR preparation recheck

- PASS: repeated `npm run test:canvas` — 27/27 suites.
- PASS: repeated `npm run test:bundle` — 339,917 initial static JavaScript bytes.
- FAIL (unchanged baseline): repeated `npm test` — 270 discovered, 255 pass, 15 fail.
- PASS: `python scripts/test-install-pyats-genie.py` — 10 mocked installer tests;
  `python ui/netclaw-visual/test/genie_adapter_test.py` — one adapter test.
- PASS: `python scripts/verify-spec-artifacts.py` — 117 checked / four historical exceptions.
- PASS: `python scripts/verify-catalog-coverage.py` — zero unexplained gaps.
- PASS: `python scripts/reconcile-mcp.py --surface catalog --surface dependencies
  --surface docs --surface meraki-ids --surface packages --surface portability`
  with `PYTHONUTF8=1`. Without UTF-8 mode, two surfaces errored on Windows text
  decoding; no verifier logic or gate was changed to get the successful run.
- PASS: contract runner `--list` and `--matrix`, including the new family. Canvas
  is excluded only from the MCP matrix and runs instead in dedicated HUD CI with
  Node and Python prepared. The Linux shell harness itself awaits CI execution.

Artifact existence is not maintainer approval or evidence of historical spec-first
development. No `--warn-only` flags were used to waive findings.
