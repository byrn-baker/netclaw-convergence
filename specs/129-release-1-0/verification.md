# Release 129 verification

## Local checks — 2026-09-28

- `python3 scripts/test-prepare-release.py`: 6/6 pass. Tests cover dry-run no-write behavior, minor reset/patch arithmetic, artifact/spec validation, duplicate-note refusal, metadata mismatch and unfinished-note rejection.
- `python3 scripts/prepare-release.py --check`: PASS, 1.0.0.
- `python3 scripts/prepare-release.py --bump patch --spec 129`: preview 1.0.0→1.0.1; no files changed (command uses `--spec 129`).
- `python3 scripts/verify-spec-artifacts.py`: PASS, 115 specs, 4 legacy exceptions.
- `python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability`: all six PASS.
- `python3 scripts/run-contract-tests.py --suite reconcile --prepare`: PASS.
- `npm --prefix ui/netclaw-visual test`: 280/280 PASS, zero skipped/failed. The two formerly sandbox-blocked listener tests now pass on this host.
- `npm --prefix ui/netclaw-visual run build`: PASS, four HTML entry points. Non-fatal >500kB chunk warning retained.
- `git diff --check`: PASS. Changed Markdown local links checked before commit.

## Baseline failure repaired

Main MCP workflow 36447235221 failed because the protected Visual HUD prose count was unlocatable after 127's README rewrite. Restored a truthful sentence with the computed 173 integrations/233 skills and an explicit configured-versus-connected distinction. No checker exception or weaker gate.

## Scope and limits

This is a source release with offline/CI evidence. No fresh live provider, gateway binding, browser journey, RAG ingestion, mobile/store or cross-host acceptance is claimed. Spec 127 and broader audit 124 acceptance gaps remain explicit. pyATS startup inventory attempted but unavailable; no device state/configuration changes. MemPalace unavailable. No tickets or social/blog messages sent.

## Publication

PR/main/tag CI and final publication are checked after this preparation commit. Public GitHub checks, release metadata and the annotated tag are the authoritative publication evidence; GAIT and daily memory record actual results. This file does not assert success for pending publication.
