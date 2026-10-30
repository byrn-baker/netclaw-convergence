# Implementation Plan: Supported OpenClaw Environment Defaults

**Branch**: `156-openclaw-env-defaults` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Replace shell fallback syntax in the canonical registration template with bare references. Move optional defaults into a per-server catalog, consumed by shared literal Python resolution in native registration and Hermes conversion. Preserve explicit references when supplied, emit missing defaults as literal strings (including empty), and migrate only recognized legacy expressions. Regeneration is required when adding a previously absent override. No installed home is changed by this development.

## Technical Context

**Language/Version**: Python 3.10+ standard library; existing TypeScript 5.9 extension.

**Primary Dependencies**: Existing JSON, dotenv writer, installer and native config contracts.

**Storage**: Source JSON defaults; existing private runtime configuration and environment.

**Testing**: Python unittest/pytest; actual pinned OpenClaw substitution module in an isolated pure probe.

**Target Platform**: Existing Mac/Linux/WSL installation paths; native Windows qualification is not added.

**Project Type**: Configuration and installer defect correction.

**Performance Goals**: One small catalog read per operation; no network calls.

**Constraints**: No shell evaluation, secret serialization in source/logs, new permissions or runtime mutation.

**Scale/Scope**: 159 expressions, 120 source variables, 64 registrations at baseline.

## Constitution Check

Before research and after design: PASS. I–III/VIII: no device operations or production changes. IV: GAIT branch active. V–VII/XI: existing integration configuration correction; no new server/skill/count. IX/XIII: missing secrets remain empty; ITSM_LAB_MODE defaults false consistently (historical Nautobot true conflicts with explicit opt-in policy). XII/XV: documentation and exact-known migration preserve custom values. XIV: no external messages/PRs. XVI: spec accepted under requested SDD, then plan/tasks/analysis before implementation. XVII: record milestone locally; no publication tool is available. All optional auto-commit hooks are disabled in git-config.yml; logical local commits will delimit completed issues.

## Project Structure

- `config/openclaw.json`, `config/mcp-env-defaults.json`: bare references and per-server nonsecret defaults.
- `scripts/lib/mcp_environment.py`: literal default resolution and native projection.
- `scripts/install-mcp-config.py`: selected registration and exact legacy merge migration.
- `scripts/lib/setup_registration.py`, `scripts/lib/setup_deploy.py`: private setup integration, empty values and remote URLs.
- `scripts/openclaw-to-hermes-mcp.py`: default-aware direct conversion.
- `scripts/migrate-tls-registration.py`: stop generating unsupported syntax.
- `scripts/check-mcp-portability.py`: inventory-wide syntax validation through existing CI.
- `extensions/netclaw-vscode/src/client/setup.ts`: bind new catalog/helper to native review input hashes.
- `.env.example`, `docs/INSTALLER-READINESS.md`: defaults and regeneration guidance.
- `tests/unit/test_mcp_env_defaults.py`, existing installer/setup/migration tests: regression coverage.

## Phases

1. Inventory and reproduce native substitution; confirm all semantic consumers.
2. Introduce catalog/helper and regressions; migrate generators and exact legacy entries.
3. Update documentation, run focused suites and existing coherence checks, record evidence.

## Complexity Tracking

No constitution violations. A per-server catalog avoids global setting collisions and preserves variable-to-environment aliases. Bare replacement without defaults and shell evaluation were rejected.
