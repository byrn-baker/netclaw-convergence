# Implementation Plan: NetClaw Dot integration

**Branch:** `134-netclaw-dot` | **Date:** 2026-09-29 | **Spec:** [spec.md](spec.md)

## Summary
Implement a narrow read-only facade and small plugin/skill package after proving the supported Dot connection. Keep NetClaw local, retain its policy and audit authority, and return only classified non-sensitive summaries. Research proof precedes transport selection.

## Technical Context
Language: Python 3.11+ proposed for facade, matching installed interpreter verification. Dependencies: MCP SDK isolated in its own environment; select/pin compatible version during implementation. Storage: private local JSONL audit plus GAIT; no new shared database. Testing: pytest synthetic adapter/contract tests plus actual Dot manual acceptance. Target: existing Linux/WSL NetClaw host, with supported desktop/SSH path only after proof. Performance: proposed 30-second request ceiling, at most 10 aliases, 16 KiB model-visible response; return partial failures. Scope: single owner MVP, no multi-tenant deployment or configuration tools.

## Constitution Check
SDD artifacts follow repository template sections. Draft ratification is outstanding before runtime code. No network writes, new credentials, deployment or transport exposure in this phase. GAIT branch active. Existing Local/Lab exception remains restricted to its API workflow. Future integration requires catalog/install/docs/tests coherence and accurate counts; do not inflate them for planning artifacts. Private-data boundary is a release gate, not a prompt convention.

## Project Structure
Current design: this directory, contracts/tools.md, docs/NETCLAW-DOT.md. Proposed implementation: mcp-servers/netclaw-dot-mcp/, plugins/netclaw-dot/, tests/dot/. Do not create speculative Dot SDK configuration. Reuse scripts/mcp-call.py for local protocol diagnostics, scripts/gait-stdio.py for audit and scripts/pyats-stdio.py for inventory. Read ui/netclaw-visual/LOCAL-LAB-CHANGE-CONTROL.md and terminal-intent-execution.js before documenting configuration handoff; do not wrap their localhost API for remote callers.

## Phases
0: Account/transport proof with synthetic data and ratification.
1: Typed local adapter, scope, safe output, audit and negative tests.
2: Minimal skill/plugin with current schema validation and desktop tests.
3: Actual Dot acceptance, revocation, operator guide, coherence review.
Remote registered app is an alternative requiring an explicit new security design if local mode is unsupported. Do not silently expand this plan to a public service.

## Complexity Tracking
No constitution exceptions granted. Connection proof and ratification are open gates. Keep existing NetClaw architecture and use three tools rather than forwarding its full MCP catalog.
