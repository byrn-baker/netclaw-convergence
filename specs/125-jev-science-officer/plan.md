# Implementation Plan: Jev Science Officer

**Branch**: `125-jev-science-officer` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

## Summary

Add an isolated FastMCP stdio evaluation service, persistent SQLite spending/approval ledger, operator-only setup controls, six narrow dynamically-questioned skills, Border workflow instructions and truthful advisor presence in the existing HUD. Preserve routing/authorization behavior.

## Technical Context

Python 3.10+; FastMCP MCP1 and httpx in isolated component environment; SQLite transactions/private files for reservations, assessments and consent. Existing Bash modular installer, Python Border workspace generator and Node/React/Three.js HUD. macOS/Linux/WSL host support. pytest/Node tests and synthetic provider smoke. Requests bounded by provider context ceiling and configured wall-clock deadline (default five seconds); no guaranteed provider latency or domain accuracy.

## Constitution Check

Pre/post design: I–III/VIII no network writes; IV actual GAIT audit with visible unavailable state; V FastMCP; VI–VII six vendor-neutral narrow skills; IX/XIII no browser key, consent and validation; X–XII installer/config/docs/HUD coherence; XIV no external communications; XV isolated dependencies/disabled compatibility; XVI ratified conversational decisions -> spec -> plan -> tasks -> analysis -> implementation; XVII local blog draft only. No exceptions. Generic chat model emulation is out of scope.

## Project Structure

- `mcp-servers/jev-mcp/`: typed service, provider validation, SQLite budget/consent and audit.
- `scripts/jev-settings.py`, `scripts/lib/`: operator controls and optional installer.
- `scripts/in2n-border-workspace.py`, federation/HUD advisor surfaces: dynamic consultation instructions and visibility.
- `workspace/skills/jev-*/SKILL.md`: six distinct workflows, no question templates/library.
- `tests/unit/test_jev*`, affected n2n/HUD tests: adversarial and compatibility acceptance.
- `specs/125-jev-science-officer/`: research, contract, tasks, analysis, verification and blog.

## Design Decisions

1. Advisor service identity rather than ordinary frontier member avoids a redundant chat model per evaluation.
2. Border authors question content. Server validates schemas, authority and budgets, never chooses commands.
3. UTC budget reservations use atomic SQLite write transactions; uncertain provider charge remains reserved.
4. Task identity comes from trusted runtime/operator context. Unscoped contexts share a conservative case to prevent model-created task IDs bypassing budgets.
5. Private disclosure approvals are operator-only, exact-payload/destination/task-bound and single-use. No model boolean grants consent.
6. Preserve dynamic question and full typed answer provenance locally; do not publish data into logs/HUD beyond intended assessment.
7. Automatic consultation is instructed in the actual Border persona; transport code cannot invent semantic decision points.

## Validation

Offline first: request/response schema, credential denial, consent replay/binding, concurrent caps/restarts, unknown charge, bounded reconsideration and timeout. Installer isolated fixtures; real MCP initialize/list/call; affected n2n/HUD tests; config/catalog/spec/inventory gates. Then synthetic live batch exercising all primitives under $0.01 cap. Record limitations explicitly, especially lack of network-specific accuracy benchmark.

## HUD scope clarification

During implementation the user reiterated that the HUD will be rewritten. Existing small advisor card/status feed suffice; stop visual expansion. Detailed science-officer data views should integrate with Adam's reusable canvas in the next HUD. See hud-handoff.md for current contracts, session-boundary requirements and explicitly deferred view fields.

## WSL adoption follow-up — 2026-09-27

User requested a concrete WSL upgrade handoff and then authorized commit/PR/merge/branch deletion/main. Read-only installed-path review found hidden interactive prompts and missing registration on existing configs. Scope adds preview/apply/conflict-safe recovery for Jev-only MCP registration and Border persona/skills, plus explicit env-file loading for the registered process. No actual WSL deployment is claimed. Preserve existing RISK identity/configuration and keep HUD changes basic. Revalidate affected paths before merge.
