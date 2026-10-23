# Research

- Main baseline: 7f2f2fe, including merged HUD PR271. No existing tags/releases at session start.
- Root contribution guide and PR template were absent. Spec Kit 0.3.1 setup is checked in under `.specify/` and `.claude/commands/`; retain this project's dot-command syntax rather than replacing it with newer upstream defaults.
- Upstream reference: https://github.com/github/spec-kit (consulted 2026-09-28). The local constitution and commands define this repository's workflow.
- `verify-spec-artifacts.py` requires spec.md, plan.md, research.md and tasks (historical combined forms accepted). New work will use separate files.
- Main HUD CI passed, but MCP reconciliation failed because the README no longer matched the protected Visual HUD inventory sentence. Actual inventory remains233skills/173integrations. Restore the sentence, not a checker exemption.
- `run-contract-tests.py` owns the suite manifest/matrix and isolated preparation; no static suite count in the new guide.
- HUD127 verification lists live gateway/RAG/per-host/mobile acceptance gaps. Those remain limitations of1.0.0; previous local listener failures have a passing Linux HUD CI run.
- Spec128 explicitly reserved in127handoff. Release documentation uses129.

## Decisions

Publish a source milestone with curated feature notes and explicit environment limits. Keep release docs in `docs/releases/`, root changelog and guide, and use the existing CI. No new network integration or device CR is needed for repository documentation.
