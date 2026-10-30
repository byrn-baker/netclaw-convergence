# Tasks: Supported OpenClaw Environment Defaults

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/environment.md.

## Phase 1: Setup

- [x] T001 Inventory and reproduce issue #262 against the qualified pin in specs/156-openclaw-env-defaults/research.md (FR-001).

## Phase 2: Foundation

- [x] T002 Add failing full-inventory/default/override/empty/legacy regressions in tests/unit/test_mcp_env_defaults.py (FR-001–FR-005).

## Phase 3: User Story 1 — Valid settings

Independent test: all affected settings resolve with synthetic absent, empty and explicit inputs; no provider starts.

- [x] T003 [US1] Introduce config/mcp-env-defaults.json and scripts/lib/mcp_environment.py; replace fallback expressions in config/openclaw.json (FR-001–FR-004).
- [x] T004 [US1] Integrate native generation, known legacy merge and isolated setup in scripts/install-mcp-config.py, scripts/lib/setup_registration.py and scripts/lib/setup_deploy.py; bind new review inputs in extensions/netclaw-vscode/src/client/setup.ts (FR-001–FR-004).
- [x] T005 [US1] Preserve optional defaults in scripts/openclaw-to-hermes-mcp.py and stop syntax reintroduction in scripts/migrate-tls-registration.py (FR-004).

## Phase 4: User Story 2 — Maintain and migrate

Independent test: portability validator rejects unsupported substitutions and guidance covers every default and regeneration.

- [x] T006 [US2] Extend scripts/check-mcp-portability.py and update .env.example plus docs/INSTALLER-READINESS.md (FR-005–FR-006).

## Phase 5: Verification and closure

- [x] T007 Run isolated focused configuration, setup, conversion and native resolver checks; record results and limits in specs/156-openclaw-env-defaults/verification.md (FR-001–FR-006, SC-001–SC-004).
- [x] T008 Record GAIT and memory/2026-10-29.md; commit completed source locally before beginning issue #300 (FR-006).

## Dependencies and Implementation Strategy

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008. US1 is the MVP; US2 establishes maintenance coverage. Documentation reading may run alongside tests, but mutations remain sequential. No parallel issue implementation: the owner's chronological order controls. No deployment or external communications.
