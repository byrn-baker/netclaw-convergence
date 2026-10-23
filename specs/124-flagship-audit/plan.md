# Implementation Plan: NetClaw Flagship Audit

**Branch**: `124-flagship-audit` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

## Summary

Establish a repository-wide inventory and reproducible baseline, review each trust boundary and operator journey, reproduce findings, then implement narrowly justified repairs with regression evidence. Use the existing isolated contract runner and reconciliation gates; extend coverage where they omit meaningful runtime behavior. Maintain an evidence ledger and do not equate catalog consistency with functional health.

## Technical Context

**Language/Version**: Python 3.10+ source (contract environments use 3.12), Node.js ES modules, Bash, Dart/Flutter and Swift mobile code.

**Primary Dependencies**: Existing MCP/FastMCP, httpx, cryptography, ChromaDB; Express/ws/Vite/React/Three.js HUD; per-component dependency isolation.

**Storage**: Existing JSON, SQLite, ChromaDB, filesystem and GAIT, including per-service telemetry history; no new datastore technology.

**Testing**: Existing 24-suite manifest, pytest and shell contracts, Node test runner, Flutter tests and simulator build workflows; targeted negative-case regressions.

**Target Platform**: macOS, Linux, WSL2. Native Windows is not a full NetClaw host; existing component support retained.

**Project Type**: Agent integration platform, MCP servers, federation daemon, CLI, browser HUD and mobile companions.

**Performance Goals**: Measure identified bottlenecks using identical workloads and report latency/resource changes; no predetermined speedup.

**Constraints**: No production changes without required CR; no secret disclosure; no global dependency churn; preserve local state; migrations for justified breaking changes.

**Scale/Scope**: All tracked files at baseline ad6a4a8, classified by subsystem. Generated/assets/vendor code receive explicit review boundaries; first-party security-sensitive paths get manual review.

## Constitution Check

Pre-design and post-design checks:

- I–III, VIII: observation before device mutation, baseline and verification, CR gates retained. Offline tests first; any live lab is explicitly identified.
- IV: GAIT branch/turn/log plus append-only evidence; startup recovery recorded.
- V–VII: preserve MCP integration and skill modularity, vendor-specific routing; no unrelated integration framework.
- IX, XIII: threat model, least privilege, secret-safe evidence, isolated dependencies, regression cases for protected operations.
- X–XII: changed capability documentation and installer/HUD/config coherence verified; phase 125 owns visual redesign, not a prerequisite for security repairs.
- XIV: local work authorized; public PRs, tickets, messages and publishing require explicit instruction.
- XV: preserve contracts when possible; executable migrations and recovery for breaking fixes.
- XVI: this spec is clarified using user decisions; plan/tasks/analysis gate implementation. Existing repository canonical path is specs/; constitution 1.2.1 separately corrects the stale path by documented PATCH amendment, preserving policy.
- XVII: produce a local milestone blog draft; do not publish it without review.

No safety or architecture exception is proposed. Native Linux confinement remains platform-specific and must not be represented as available on macOS/WSL merely because they are supported hosts.

## Project Structure

```text
specs/124-flagship-audit/
  spec.md, clarification.md, plan.md, research.md, data-model.md
  contracts/audit-and-migration.md, quickstart.md, tasks.md
  analysis.md, coverage.json, findings.md, verification.md, handoff.md
  evidence/                         # sanitized baseline and verification outputs
mcp-servers/                       # integrations, RAG, memory, federation
src/netclaw_tokens/                 # GCF and budget/cost logic
scripts/                           # install, audit, lifecycle and CLI
ui/netclaw-visual/                  # HTTP/WebSocket and existing views
mobile/netclaw-mobile/              # Flutter/iPhone/watch boundaries
workspace/skills/                   # operational guidance and tool contracts
tests/                             # existing suites and targeted regressions
.github/workflows/                  # offline checks, mobile builds
```

**Structure Decision**: Repair in the owning subsystem; keep feature audit artifacts in this spec. Do not introduce another product runtime or duplicate upgrade orchestration before phase 3a.

## Execution phases

1. Inventory tracked files and existing checks; capture environment and baseline without starting live agents. Inspect harnesses before executing any test capable of external side effects.
2. Review scripts/installer/config/CI and safety-sensitive UI, federation, RAG, voice/Zoom/mobile entry points. Review other MCP integrations by shared patterns and per-server boundaries, with explicit coverage status.
3. Run independent offline suites in isolated environments; inspect missing/held-out coverage. Record failing baseline separately from new regressions.
4. For each reproducible finding, add a concrete task and evidence link, update requirements if behavior changes, repeat cross-artifact analysis, then repair and verify. Security fixes take priority.
5. Verify migrations on old-state fixtures; maintain the currently usable Mac installation. Request specific live services/platform runs only when required.
6. Run coherence gates, relevant regression suites, documentation render/link review for changed sections, platform acceptance matrix; write final audit report, local blog draft and phase-125 handoff.

## Validation strategy

The contract runner advertises 22 suites, six explicitly held out of CI. All are inventory entries, not presumed passes. Linux-only downloads and native confinement tests are separate from portable contracts. Existing empty/skipped tests are not coverage. A finding closes only with reproducible evidence and a verification record; live blockers keep the affected acceptance criterion open.

## Complexity Tracking

No added framework or datastore. The broad scope is managed by evidence and tasks, not by a blanket claim that every line or integration has been exercised.

## Bounded closeout amendment — 2026-09-27

Explicit user direction supersedes exhaustive-review scope: finish confirmed001–103 repairs and final checks, triage remaining evidence for safe-use blockers, and defer unreviewed paths in [deferred-review.md](deferred-review.md). Only confirmed security, data-loss or installation/runtime failures preventing safe use extend this phase. Spec125 remains the HUD redesign. Merge PR265 and return to main before backing up and migrating the actual local runtime. Completion means this bounded scope, not100% source certification.
