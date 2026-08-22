# Spec 080-convergence: Frozen Reference

**Superseded**: 2026-08-20  
**Active specs**: 1001–1008 (see `specs/1000-convergence-architecture-review/plan.md`)

This folder is a **frozen reference** — no new tasks will be added here, but the
decision records, contracts, and implementation history remain canonical. The new
1001–1008 specs each carry a copy of their relevant decision record for
self-containment, but this folder is the single source of truth for cross-cutting
history (tasks.md, data-model.md, contracts/).

## Decision records (canonical copies here, working copies in new specs)

| Record | Also in |
|--------|---------|
| `otel-convergence.md` | `specs/1007-otel-convergence-hub/decision-record.md` |
| `suzieq-state-observability.md` | `specs/1008-suzieq-state-plane/decision-record.md` |
| `investigation-policy.md` | `specs/1001-alert-investigation-pipeline/decision-record.md` |
| `telemetry-setup.md` | `specs/1003-telemetry-setup-wizard/decision-record.md` |

## Decomposition

| New spec | Extracted from 080 |
|----------|-------------------|
| 1001-alert-investigation-pipeline | US4, US8, Phase 9 (T096–T110) |
| 1002-deployable-obs-stack | US3, Phases 3–5, 7–8 (T030–T095) |
| 1003-telemetry-setup-wizard | US9, Phase 10 (T120–T138) |
| 1004-investigation-feedback-loop | US7, Phase 6 (T060–T063) |
| 1005-hud-home-tab | US1, US2, Phases 1–2, H (T010–T026, H000–H010) |
| 1006-grafana-board-suite | US10, Phase 10 PR4 (T139–T144) |
| 1007-otel-convergence-hub | US11, Phase 11 (T145–T156) |
| 1008-suzieq-state-plane | US12, Phase 12 (T158–T170) |

## Why frozen (not deleted)

- `tasks.md` is the authoritative record of what was completed and when
- Decision records document measured facts and operator rationale
- Contracts define API shapes the running code implements
- `data-model.md` describes the Postgres schema and event lifecycle
- Other files in the repo (`otel-config.yaml`, `promtail-config.yml`, adapter READMEs)
  link here for design context — breaking those paths would create dead links
