# Contributing to NetClaw

NetClaw welcomes fixes, integrations, skills, tests and documentation. **Every PR must link a numbered specification and follow Spec Kit.** Describe the intended behavior and acceptance criteria before implementing it. AI-assisted contributions follow the same review and verification requirements as any other contribution.

## Start with a numbered spec

Read the [project constitution](.specify/memory/constitution.md) and [operating instructions](AGENTS.md). Use [GitHub Spec Kit](https://github.com/github/spec-kit) with the commands and templates already checked into this repository: [.claude/commands/](.claude/commands/) and [.specify/templates/](.specify/templates/). The checked-in integration uses `/speckit.specify` dot commands. Other agent integrations may use different invocation syntax; preserve this repository's artifacts and constitution when adapting them. Do not reinitialize or overwrite the project setup just to submit a PR.

1. Sync with upstream `main` and inspect `specs/`, open PRs and remote branches. Discuss substantial changes with a maintainer before building them; a draft PR containing the proposed spec is a useful starting point.
2. Use a unique, sequential number with at least three digits and a short descriptive name: `specs/NNN-short-description/`. Use the same `NNN-short-description` for the feature branch. The helper normally chooses the next number; coordinate reservations with maintainers. Check for collisions again before opening your PR. Do not reuse a number or rename historical specs to hide existing duplicates. Spec 128 is reserved; spec 129 is this release.
3. Run the Spec Kit lifecycle in your coding agent, one step at a time:

   ```text
   /speckit.specify Describe the problem, users, desired behavior and acceptance criteria
   /speckit.clarify
   /speckit.plan Describe the implementation approach and constraints
   /speckit.tasks
   /speckit.analyze
   /speckit.implement
   ```

   These are agent commands, not shell commands. Clarification and analysis are especially useful when scope or safety is uncertain. Resolve material ambiguities and obtain maintainer agreement on substantial scope before implementation. Keep tasks and acceptance evidence current as work proceeds.
4. Commit at least `spec.md`, `research.md`, `plan.md`, and `tasks.md` in the numbered spec directory. Add contracts, data models and quickstarts where applicable. Record actual commands, results and untested boundaries in `verification.md`.
5. Open a PR against `main` using the provided template. Put the spec number in the title, for example `feat(hud): add investigation filters (spec NNN)`, and link the exact spec directory and evidence in the body.

For a scoped follow-up or small correction, you may update an existing numbered spec if the change belongs to that spec's agreed scope. Explain the relationship and add tasks and verification there. Otherwise create a new numbered spec, including for documentation-only work. Keep the artifacts proportional to the change, but **do not submit a spec-free PR or write the spec only after implementing the feature**. Historical exceptions in the checker are not permission to create new exceptions.

The branch helper used by Spec Kit is available for manual setup (do not run it again if `/speckit.specify` already created your branch):

```bash
bash .specify/scripts/bash/create-new-feature.sh --json --short-name short-description 'Describe the proposed change'
```

Check the selected number before proceeding. Use `--number N` only for a coordinated reservation; use sequential numbers, not timestamp mode, for NetClaw contributions. If your coding agent lacks slash-command support, follow the checked-in command instructions and templates explicitly and disclose that in the PR. The same spec → plan → tasks → implementation order applies.

## Verify your change

Run these from the repository root:

```bash
python3 scripts/verify-spec-artifacts.py
python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability
python3 scripts/run-contract-tests.py --list
python3 scripts/run-contract-tests.py --matrix
```

Select the suites affected by your change, using names from `--list`. For example:

```bash
python3 scripts/run-contract-tests.py --suite reconcile --prepare
```

`--prepare` downloads dependencies and writes isolated, ignored environments; it does not install into the system interpreter. For broad changes, run `--suite all --prepare` (potentially substantial downloads). The suite manifest determines CI coverage; do not assume a fixed number of suites. Add new test families to that manifest and justify any CI exclusion. See the [quality-gate quickstart](specs/123-contributor-quality-gates/quickstart.md) for the runner workflow; the current manifest is authoritative for counts.

For HUD changes:

```bash
npm --prefix ui/netclaw-visual ci
npm --prefix ui/netclaw-visual test
npm --prefix ui/netclaw-visual run build
```

Include browser interaction evidence when UI behavior changes, especially Canvas storage, session continuity, access controls and Basic/Advanced navigation. Passing unit tests does not prove a live gateway, provider, phone or network works. Mobile changes should also follow the [mobile development instructions](mobile/netclaw-mobile/README.md).

Report `PASS`, `FAIL`, `BLOCKED_DEPENDENCY`, `NEEDS_LIVE_CREDENTIALS`, `NEEDS_DOCKER` and `ERROR` accurately. A missing credential or unavailable lab is a coverage gap, not a passing live test. Do not use `--warn-only` to waive a declaration failure. Startup verification is meaningful on an installed host; fresh-checkout CI cannot prove that optional servers are installed and reachable.

## Keep integrations coherent and safe

A new capability must update all applicable surfaces in the constitution's artifact checklist in the **same PR**: README, `SOUL.md`, `TOOLS.md`, skill documentation, server README, `.env.example`, MCP registration, installer catalog and install function, HUD and tests. Explain any non-applicable item. Run `python3 scripts/verify-catalog-coverage.py`; inventory counts must come from the repository, not estimates.

Keep dependencies isolated and bounded, preserve existing tool interfaces or document migration, and prefer read-only defaults. Never commit credentials, private configurations, packet captures or customer topology. Use sanitized fixtures. Do not put production credentials into PR CI. Live device changes require observation, a recorded baseline, approved change management and post-change verification under [AGENTS.md](AGENTS.md); contributing code does not authorize operating someone else's network. Record NetClaw development sessions through GAIT and daily memory as those instructions require.

## Version the completed spec

Every completed spec advances NetClaw once: a new capability gets a minor bump (`1.0.0` → `1.1.0`); a fix, documentation or maintenance change gets a patch (`1.1.0` → `1.1.1`). Draft specs and individual tasks do not trigger releases. Before merge, use `scripts/prepare-release.py` to prepare `VERSION`, changelog and release notes as described in [the release process](docs/RELEASING.md). Coordinate the version against current main; spec numbers and release numbers are independent. Breaking changes require a maintainer compatibility decision.

## Review and merge

Keep PRs focused. Explain the problem, resulting behavior, spec links, verification, compatibility, migration and remaining risks. Check only completed checklist items. Update the spec and plan if scope changes. Maintainers review the spec, implementation and evidence together; passing the artifact checker proves files exist, not that the design is correct or the scope approved. PRs missing numbered specs, required artifacts or credible verification are not ready to merge.

Contributions are made under the repository's [Apache-2.0 license](LICENSE). Retain attribution and document the licenses of third-party code. For release maintainers, see [the release process](docs/RELEASING.md).
