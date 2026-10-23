# Spec151 Discovery

## Baseline

- Main at start: `357521eb883720aad581e6d0d278443d42e86ad1`, merged PR293.
- Spec150 final artifact remains `NetClaw.netclaw@0.1.0`, SHA-256 `b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8`.
- Work is local on `151-extension-experience`; no packaging, pushing, deployment or publication is authorized.
- `.specify/extensions.yml` requires the git feature-branch hook. It ran successfully once. Optional auto-commit hooks are disabled by `.specify/extensions/git/git-config.yml`.

## Visual Reference

[automateyournetwork.com](https://automateyournetwork.com/) was read and visually inspected on 2026-10-11. The desktop homepage uses a near-black background, off-white oversized headings, magenta-to-cyan accent typography, outlined dark cards, compact tracked labels and a contained interactive globe. These are design-reference observations, not a decision to copy the site's content or introduce its visitor tracking.

Owner explicitly likes the extension's blue buttons, search and filters. Preserve those interaction strengths while improving information hierarchy, typography, input design and page composition. Do not interpret card styling as a requirement to adopt Microsoft Adaptive Cards.

## Existing Extension Observations

- `src/extension.ts` requests a label with only “Connection label”; this is an operator-defined nickname, separately followed by the API URL and reviewed identity binding.
- `resources/data.js` recursively renders observations with nested definition lists. This explains the repeated raw-field layout across domain pages; a CSS-only change would not fully address the requested organization.
- `resources/workbench.css` provides shared basic styling but limited hierarchy and form grouping.
- `src/views/settings.ts` already reads the integration configuration inventory and supports reviewed single-field replacements through the existing environment writer. It masks every replacement input and verifies only configured presence; accepted write is not exact-value, loaded-runtime or endpoint verification.
- `src/client/domains.ts` distinguishes configured network (`/api/graph`) and BGP topology (`/api/bgp`), but the user-facing relationship to testbed management needs clarification.
- HUD source already exposes raw testbed read/write, a structured revision-aware edit helper, and per-integration environment metadata. Their exact preservation, validation, identity and concurrency behavior requires planning-stage assessment before reuse.
- Follow-up source inspection: raw testbed replacement currently validates YAML syntax and writes atomically, but supplies no revision check or backup. Structured terminal-device editing checks revisions, creates private backups, preserves unrelated fields and revokes device collection consent; it is restricted to supported explicit SSH profiles. Neither path should be described as complete safe generic testbed management without addressing these differences in planning.

## Clarification Workflow

Owner requires at least five questions before planning. The clarify skill asks one question at a time and records each accepted answer immediately. No answer is inferred from silence. Keep the remaining workflow active across clarification turns, then proceed autonomously through plan, tasks, analyze, finding resolution and implementation within the owner's local-only constraints.
