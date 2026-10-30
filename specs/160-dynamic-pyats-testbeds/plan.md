# Implementation Plan: Dynamic pyATS testbeds

**Branch**: `160-dynamic-pyats-testbeds` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Summary

Adopt pinned upstream dynamic tools behind a managed source-composition boundary.
A shared source catalog and normalizer feed real upstream build/validate/activate
operations. Both installer families persist a per-claw static/dynamic policy.
Native sessions and an explicit one-process CLI have honest inventory lifetimes.

## Technical Context

**Language/Version**: Python 3.10+ standard library for installer/normalization;
Python 3.12 isolated pyATS runtime; TypeScript 5.9 and Bash 3.2.
**Primary Dependencies**: existing pyATS/Genie/Unicon, MCP 2.3.0, VS Code APIs,
Node 24.19+ supported branch and existing build/test tools. No new vendor client.
**Storage**: secret-free Claw Plans; existing private runtime env; private candidate
files; upstream registry only in process memory.
**Testing**: unittest, Node test runner, extension build, Bash syntax/PTY, actual
isolated upstream MCP process and real pyATS schema loader; no device I/O needed.
**Target Platform**: macOS native qualification here; Linux/WSL source-compatible
with explicit separate host qualification.
**Project Type**: existing MCP integration plus installer/extension.
**Performance Goals**: bounded envelopes <=8 MiB / 5000 records; no hidden network
work on installer selection; no background inventory refresh.
**Constraints**: no owner-runtime mutation, secret echo, arbitrary source HTTP client,
static inventory replacement, silent fallback, or inferred device authorization.
**Scale/Scope**: twelve sources plus structured and REST-export inputs; one candidate
active per owned MCP process; same candidate cannot change after preview.

## Constitution Check

Pre-research and post-design PASS. I–IV/VIII: no device operations during discovery,
GAIT records changes; production change controls remain unchanged. V–VII: use
existing source MCPs and official upstream MCP registration; normalization is local
input adaptation, not a new vendor API. IX/XIII: env-only credentials, strict schema,
private outputs, bounded source records. X/XI/XII: update existing pyATS catalog/HUD
card and static-editor explanation, README, SOUL, TOOLS, .env.example and existing
pyats-network skill; no new server/skill/node count is introduced. XV: static default,
additive plan contract, isolated pinned runtime. XVI: spec/plan/tasks precede code.
XIV/XVII: prepare local milestone draft only; external publication remains separate.

## Project Structure

- `config/pyats-testbed-sources.json`: canonical source descriptors/mapping contracts.
- `scripts/lib/pyats_testbeds.py`: pure bounded source normalization/policy helpers.
- `scripts/pyats-managed.py`: owned upstream launcher, registered composition tool,
  immutable candidates and validation/activation guards.
- `scripts/pyats-testbed-session.py`: official MCP one-process CLI.
- `scripts/setup-pyats-runtime.py`, `scripts/pyats-stdio.py`: pin and owned launch.
- `config/claw-plan.schema.json`, `scripts/lib/setup_{plan,generated,effects,deploy,cli}.py`:
  policy validation, exact review, preservation, env and readiness.
- `scripts/setup.sh`, `scripts/lib/install-steps.sh`, `scripts/lib/plan-cli.sh`:
  terminal flows.
- `extensions/netclaw-vscode/src/setup/` and `src/views/setup-wizard.ts`:
  typed policy, native mode/source selection and review.
- `config/components/catalog.json`, `config/installer-access.json`,
  `scripts/installer-readiness.py`, HUD env-map/static-editor text: coherent discovery.
- `tests/test_pyats_testbeds.py`, `tests/test_pyats_dynamic_runtime.py`, installer tests,
  extension tests and `specs/160-dynamic-pyats-testbeds/verification.md`: evidence.

## Delivery phases

1. Complete research/contracts/tasks and cross-artifact analysis.
2. Source descriptors, normalization and pinned runtime guards with adversarial tests.
3. Both installer paths and VS Code policy selection/read-back, preserving static data.
4. Actual MCP and UI acceptance, docs/version/history/coherence, local review commit.

## Complexity Tracking

No constitution exceptions. The owned launcher is necessary to enforce lifecycle and
credential boundaries without forking upstream; pin and actual-process tests constrain
that coupling. No persistent session service or additional vendor HTTP implementation.
