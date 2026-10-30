# Implementation Plan: IDE Installer — Zero to a Tested Claw or Risk

**Branch**: `153-ide-installer` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

Make first-time installation a first-class capability with three front doors (CLI, Wizard, Assistant). All three converge on one secret-free **Claw Plan**, one **setup engine** shipped in the NetClaw checkout, and one **Claw Report**.

The extension gains:

- a no-installation mode with a bundled **bootstrap**: platform gate, prerequisites and source acquisition;
- a card-based **setup wizard** built on the Spec 151 theme;
- **provisioning-mode setup tools** on its existing MCP adapter, so Copilot, Claude Code and Codex can run the whole flow from zero.

A **canonical component catalog** replaces the free-text catalog strings as the source of every card, documentation link, settings field and Shape Advisor estimate. `catalog.sh` and the TUI stay backward compatible.

The engine reuses the existing `core_*` and `component_install_*` functions, readiness states and private writers rather than reimplementing installation.

Baseline: NetClaw 1.11.0 (`main` at merge of #299), extension source 1.1.0, Spec Kit 0.7.1 with the Codex integration. Proposed release targets are NetClaw 1.12.0 and extension 1.2.0; the owner confirms these at release.

## Technical Context

**Language/Version**: TypeScript 5.9 for the extension (existing esbuild build). Python 3.10+ standard library for the setup engine, plan validator and catalog tooling, consistent with `installer-preflight.py` and `installer-readiness.py`. Bash for the existing step functions. JSON Schema 2020-12 for the Claw Plan and the catalog.
**Primary Dependencies**: Existing VS Code APIs (webviews, walkthroughs, terminals, native input and modal dialogs, MCP server definition provider) and the existing MCP SDK in `dist/assistant.mjs`. Existing installer libraries, readiness, preflight, `component-launch.py`, `in2n-*` helpers and private-file writers. No new Python runtime dependencies for the engine; no new UI framework.
**Storage**: Claw Plans live where the user chooses (deployment workspace or a private setup folder) and contain no secrets. Setup-run journals use a private pre-runtime state directory until the runtime home exists, then the existing `<runtime-home>/netclaw-hud/setup/` evidence area (R7). All of these use 0700 directories and 0600 files. Secrets go only to runtime or member environment files through existing writers. Editor state holds only non-secret wizard answers and run references.
**Testing**: Python `unittest` for the engine, validator and catalog. Node tests for the extension. The existing installer regression suite. Fixture homes via a temporary `HOME`, and simulated `wsl.exe` output, including its UTF-16 encoding. The existing native VS Code observer plus Playwright CDP for the wizard. Assistant contract tests against recorded tool transcripts, plus live qualification runs.
**Target Platform**: macOS (Apple silicon primary; Intel where prerequisites permit). Windows 10/11 with WSL2 and a supported Ubuntu LTS, where the extension runs in the WSL remote host. A native Windows extension host is used for the read-only gate only.
**Project Type**: Existing VS Code extension plus installer tooling; adds a setup engine and a catalog data source.
**Performance Goals**: Spec SC-013. Wizard steps render from a locally cached catalog within 500 ms. Engine progress events reach the UI within 1 s. No polling blocks the UI.
**Constraints**:
- No privilege elevation by the extension and no automatic WSL enablement.
- No secret values in plans or assistant context.
- Apply only after a review bound to the plan hash.
- `install.sh` stays a thin dispatcher.
- No telemetry.
- Development and testing touch isolated fixture homes only.
**Scale/Scope**: 110 components, 238 deployable skills, about 40 iN2N member profiles, 9 install profiles, 2 harnesses, 3 assistants, 2 platforms, 12 user stories.

## Architecture

```text
 CLI / TUI ──────┐
 Wizard ─────────┤                       validate · explain
 Copilot ────────┼──► Claw Plan ───────► setup engine (in checkout) ──► Claw Report
 Claude Code ────┤   (secret-free)        apply · resume · verify
 Codex ──────────┤        ▲                       │
 Spec Kit ───────┘        │                       ▼
                   canonical catalog     existing core_* / component_install_*,
                   (cards, links, fields,  readiness, private writers, in2n helpers
                    estimates, joins)
```

1. **Two-stage execution.** At zero there is no checkout. So the extension bundles a minimal **bootstrap**: host classification, the Windows gate, prerequisite probes and remedies, and source acquisition and verification. It runs on VS Code's own runtime and needs no host Node. After acquisition, the extension drives the **engine from that checkout**, so installation logic always matches the code being installed. A declared engine protocol version gates compatibility (FR-010).
2. **Claw Plan.** One JSON document (`netclaw-plan.json`) with a published JSON Schema, so VS Code validates it as it is edited. Sections: `schema`, `source`, `host`, `harness`, `providers`, `channels`, `shape`, `capabilities`, `members`, `settings` (references only), `inventory`, `identity`, `posture`, `verification`. The hash is computed over canonical JSON. A CLI-saved plan, a wizard-saved plan and an assistant-drafted plan are byte-compatible.
3. **Setup engine.** One entry point with the subcommands `validate`, `explain`, `apply`, `resume`, `status` and `verify`. It emits JSON Lines events (phase, progress, needs-input, secret-request, outcome, log-ref) and accepts framed answers and secrets on stdin. Apply drives the existing step functions through a narrow Bash bridge in `scripts/lib/`. It journals before and after each effect, holds one lock per runtime home, and observes unknown outcomes rather than replaying them. Interactive components and harness-native onboarding run in a visible terminal, and the engine verifies afterward.
4. **Canonical catalog.** A schema-validated data file, or one file per component (decided in R9), becomes the source for `catalog.sh` (generated or read, preserving `--list`), the wizard cards, the assistant tools, the Shape Advisor and the iN2N member mapping. It resolves the Spec 151 join mismatches and the duplicate Catalyst Center fields with explicit mappings. Skill descriptors derive from `SKILL.md` front matter plus joins.
5. **Wizard.** A webview using the Spec 151 card theme with a persistent tree map. Answers are held in memory and in non-secret editor state for resume. Secrets go through native password inputs and straight to the engine's stdin. Review uses the engine's `explain` output and a native modal confirmation that produces the review token.
6. **Setup broker.** Assistant adapters are separate processes. The extension therefore hosts a per-window private local endpoint (exact transport in R12), with a random token in an owner-only registration file. Adapters use it to reach native UI: secret entry, plan review, progress. With no window present, the assistant tools degrade to read-only, plus instructions to open VS Code or use the CLI.
7. **Assistant surfaces.** Copilot gets a "NetClaw Setup" MCP definition from the existing provider when no connection is bound, launched with the editor runtime (`ELECTRON_RUN_AS_NODE`) as today. For Claude Code and Codex, the registration preview is extended to provisioning mode, using the editor runtime or another Node-free launch path (R12). One install skill is the shared brain, and its source lives in the repository. The extension bundles a stamped copy and, with consent, installs it into each harness's supported skill location.
8. **Spec pathway.** A NetClaw claw preset for Spec Kit (templates and safety principles) scaffolds a deployment workspace outside the checkout. Its plan output is a Claw Plan, and "implement" submits that plan to review.

## Constitution Check

Pre-research gate: PASS for owner-authorized planning. Post-design re-check is required after Phase 1.

- **I–IV, VIII (Safety, Read-Before-Write, ITSM, Audit, Verify)**: Installation acts on the host, not on network devices. The only device interaction is the opt-in Tier 6 read-only `show`. Every host mutation is observed, reviewed, journaled and verified. When GAIT is part of the plan, verification records an installation summary entry referencing the plan hash. Development sessions remain GAIT-logged.
- **V–VII (MCP-native, multi-vendor, skill modularity)**: Setup tools extend the extension's existing MCP adapter; no new `mcp-servers/` server is added. The catalog is vendor-neutral and the skills are unchanged.
- **IX, XIII (Security, Credential Safety)**: Safest defaults, no secrets in plans or assistant context, per-member secret scoping, owner-only files, and secrets persisted only to `.env` files through existing writers.
- **XI (Full-Stack Artifact Coherence)**: The canonical catalog changes which files satisfy the installer touchpoint. This requires a constitution MINOR amendment (to 1.3.0), drafted in this feature, naming the catalog file alongside `catalog.sh`/`install-steps.sh` and extending `verify-catalog-coverage.py`. No new MCP capability is added, so the other checklist items apply only where documentation changes.
- **XII (Documentation-as-Code)**: FR-054 docs ship in the same PRs as the code.
- **XIV (External communications)**: Tier 5 channel tests require per-message approval. Assistants cannot send messages through setup tools.
- **XV (Backwards compatibility)**: Existing flags, TUI behavior, manifests and extension workflows are regression-gated (SC-012). `install.sh` changes are limited to flag dispatch into `scripts/lib/`.
- **XVI (SDD)**: specify → clarify (done) → plan/research/contracts → tasks → analyze → implement → verify.
- **XVII (Milestones)**: A local `milestone-draft.md` only; publishing requires the owner.

## Project Structure

```text
specs/153-ide-installer/
  spec.md plan.md research.md data-model.md quickstart.md tasks.md
  analysis.md verification.md milestone-draft.md
  contracts/ claw-plan.schema.json component-catalog.schema.json
             engine-protocol.md setup-tools.md setup-broker.md
             install-skill.md spec-kit-preset.md
config/
  components/            canonical catalog (+ schema)        [R9 decides layout]
  claw-plan.schema.json
scripts/
  install.sh             flag dispatch only: emit/validate/apply plan
  setup-engine.py        validate · explain · apply · resume · status · verify
  lib/plan-steps.sh      narrow bridge to existing core_* / component_install_*
  lib/catalog.sh         generated from or reading the canonical catalog (compat)
  build-catalog.py check-catalog-metadata.py check-catalog-links.py
  verify-catalog-coverage.py   extended for the canonical catalog
extensions/netclaw-vscode/
  src/setup/       host.ts gate.ts prerequisites.ts source.ts engine.ts
                   plan.ts secrets.ts runs.ts broker.ts advisor.ts
  src/views/setup.ts            wizard webview host (existing views/setup.ts is
                                Spec 151 MCP setup — rename or namespace, no regressions)
  resources/setup-wizard.js resources/setup-wizard.css   Spec 151 card theme
  src/assistants/  provider.ts server.ts   provisioning-mode definitions + tools
  resources/install-skill/      stamped copy of the shared install skill
  resources/spec-kit-preset/    NetClaw claw preset
  package.json     walkthrough "Set up a new NetClaw", commands, jsonValidation
<install-skill source>          single source of truth            [R12 decides path]
docs/  GETTING-STARTED-VSCODE.md WINDOWS-WSL-PREREQUISITES.md CLAW-PLAN.md
       ASSISTANT-INSTALL.md SPEC-KIT-CLAWS.md INTENT-PROMPTS.md
README.md AGENTS.md CLAUDE.md   "Three ways in"; pointer to the install skill
.specify/memory/constitution.md  XI amendment (MINOR)
```

The `.agents/skills/` folder currently holds Spec Kit skills that Codex uses to **develop** NetClaw. R12 must decide whether the user-facing install skill lives there or in a dedicated folder, so that development agents are not confused by end-user install instructions.

## Phase 0 — Research (`research.md`)

Each item must record its decision, the evidence (with live source links, verified at research time), rejected alternatives and remaining limits.

- **R1 Windows gate and WSL handoff**: Detection commands and their output encodings, WSL version per distribution, the default distribution, VS Code WSL extension detection, the reopen-in-WSL command, supported Ubuntu releases, and how non-secret wizard state survives the move from the local to the remote extension host.
- **R2 Harness onboarding interfaces**: Supported non-interactive options of `openclaw onboard` and `hermes setup`; how to enumerate providers, models and channels per harness version; which steps must stay native-interactive; how to verify their results.
- **R3 Local providers**: Which local runtimes each harness supports, detecting installed models, model download size and hardware disclosure, and readiness checks (building on the existing Ollama check).
- **R4 Prerequisite remedies**: Per-platform fixed remedy commands (Xcode Command Line Tools, Homebrew presence, apt), respecting nvm/fnm/volta and Homebrew Python, PEP 668, Docker availability, sudo inside a visible terminal, and the bundled baseline used before acquisition.
- **R5 Source acquisition**: Release resolution through the GitHub API with a git-tag fallback, proxy and TLS-interception behavior, ref and commit verification, the extension–engine compatibility range, and the main-channel warning.
- **R6 Plan format**: Schema design, canonicalization for hashing, schema versioning and migration, stdlib validation strategy, literal-secret detection, and the VS Code `jsonValidation` contribution.
- **R7 Engine design**: Driving the existing functions per phase without changing `install.sh` behavior; idempotency per step; journal location before the runtime home exists; locking; the resume algorithm; the interactive component list; the event protocol.
- **R8 Secret transport**: Stdin framing between extension and engine, reuse of the existing env writers, member-scoped env files for a Risk, redaction tests, and behavior on editor reload.
- **R9 Catalog**: File layout; field sourcing for all 110 components (`catalog.sh`, the README tables, `mcp-servers/*/README.md`, `installer-access.json`, `ENV_MAP`, `.env.example`) and 238 skills; link policy and CI cadence; card-ID joins; `catalog.sh` generation versus reading.
- **R10 Shape Advisor**: The estimate model and thresholds, grounded in `docs/N2N-RISK.md` measurements, the trust-domain heuristic, and presenting estimates honestly.
- **R11 Single-host Risk**: Border and member creation for OpenClaw and Hermes (`in2n-member-home.py`, `in2n-profiles.py`), automated enrollment without exposing tokens, hot versus on-demand members, production-mode prerequisites on macOS (launchd) and WSL (`systemd --user` requires systemd enabled in WSL), and posture reporting.
- **R12 Assistant surfaces**: Provisioning-mode MCP definitions; a Node-free launch for Claude Code and Codex registration; current skill discovery locations and scopes for Codex, Claude Code and Copilot, verified against each vendor's current documentation; prompt files or custom agents available at the chosen VS Code minimum; staging rather than executing in each harness's approval modes; the broker transport on macOS and WSL; the location of the install skill's source.
- **R13 Spec Kit preset**: Packaging presets and templates for Spec Kit 0.7.x, harness integrations, the deployment workspace layout, and the spec → Claw Plan mapping.
- **R14 Verification**: Reuse of readiness states, a live-turn mechanism per harness, cost disclosure, channel test approval flow, Tier 6 through the pyATS access path, and Risk tier checks (`n2n_risk_status`, `n2n_member_health`, `n2n_posture`).
- **R15 VS Code minimum version**: Required APIs, feature gating, and the impact on existing users.
- **R16 Cleanup**: Journaled-created artifact classes, ordering, and refusal rules.

## Phase 1 — Design outputs

- **`data-model.md`**: Every Key Entity in the spec, with fields, states, transitions and ownership. This includes the Setup Run state machine (planned → reviewed → applying → phase states → verified/failed/unknown → resumable) and the wizard answer model with its invalidation graph.
- **`contracts/claw-plan.schema.json`** and **`component-catalog.schema.json`**: normative schemas with examples. Examples contain secret references only.
- **`contracts/engine-protocol.md`**: Subcommands, exit codes, event types, input frames, the version handshake, the lock and journal semantics, and the review-token binding.
- **`contracts/setup-tools.md`**: Each provisioning-mode tool's name, description, input and output schema, annotations (read-only versus opens-UI), errors, and what each tool must never return.
- **`contracts/setup-broker.md`**: Transport, authentication, lifetime, the permitted requests (open review, request secret, progress subscription) and refusal behavior.
- **`contracts/install-skill.md`** and **`contracts/spec-kit-preset.md`**: Structure, the question order and the safety rules the skill must encode; the preset files and their mapping to the plan.
- **`quickstart.md`**: A fixture walkthrough for every pathway and platform, including how to create disposable hosts and snapshot them.

## Delivery sequence

Milestones follow dependencies. Each milestone ends with its stories' independent tests passing.

| # | Milestone | Stories | Exit evidence |
| --- | --- | --- | --- |
| M0 | Research and Phase 1 contracts; constitution XI amendment draft | — | `research.md`, contracts, data model, quickstart reviewed by owner |
| M1 | Canonical catalog, generator, CI checks, joins, link checker, `--list` parity | US11 | Catalog completeness 100%, byte-compatible TUI listing, CI green |
| M2 | Claw Plan schema and validator, headless engine, CLI emit/validate/apply | US5 (engine), US10 | CLI applies plans in fixture homes; interruption suite; parity baseline |
| M3 | Extension no-installation mode, Windows gate, prerequisites, source acquisition, walkthrough | US1, US2 | Gate matrix with zero-change snapshots; acquisition matrix |
| M4 | Wizard tree, cards, settings, inventory, identity, review, apply UI, resume | US3, US5 | Focused-claw installs through the wizard on macOS and WSL |
| M5 | Verification tiers, Claw Report, connection handoff | US6 | Tier matrix with no inferred success; Workbench handoff |
| M6 | Shape Advisor and single-host Risk | US4 | Border plus ≥3 mixed-provider members verified; honest posture |
| M7 | Broker, provisioning tools, install skill, Copilot/Claude Code/Codex Q&A, then Intent | US7, US8 | Assistant matrix: zero applies or secrets via tools; parity with wizard |
| M8 | Spec Kit preset and deployment workspace | US9 | Spec → plan → review → apply → report written back |
| M9 | Cleanup, docs, coherence checklist, qualification, usability, milestone draft | US12, all | `verification.md` with SC-001–SC-013 evidence and limits |

## Qualification matrix

| Platform | Pathway | Harness | Shape | Required evidence |
| --- | --- | --- | --- | --- |
| macOS clean (Apple silicon) | Wizard | OpenClaw | Focused, `recommended` | Tiers 1–4; Tier 5/6 in fixtures |
| macOS clean | Wizard | Hermes | Focused, `minimal` | Tiers 1–4 |
| macOS | Copilot Q&A | OpenClaw | Focused | Tool transcript audit; parity diff with wizard |
| macOS | Claude Code Intent | Hermes | Risk (Border + 3) | Risk tier; per-member secret scope |
| WSL2 Ubuntu clean | Wizard | Hermes | Risk (Border + 3) | Risk tier; posture honesty |
| WSL2 Ubuntu | Codex Q&A | OpenClaw | Focused | Tool transcript audit |
| WSL2 Ubuntu | Spec Kit (Codex) | OpenClaw | Risk | Report written back; no secrets in workspace |
| WSL2 Ubuntu | CLI `--plan` (wizard-made plan) | OpenClaw | Focused | Parity diff |
| Windows, WSL disabled | Gate | — | — | Hard stop; zero-change snapshot |
| Windows, WSL 1 only / no distro / no WSL extension | Gate | — | — | Specific stop per condition; zero change |
| Windows, WSL2 + Ubuntu | Gate → reopen → resume | — | — | 100% non-secret answers restored |

Usability: at least five participants without CLI experience (SC-002). Accessibility checks follow SC-011. Live-provider and live-channel runs use owner-approved test accounts only. Anything not run is recorded as unqualified, never implied.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Scope size across three pathways | One plan and one engine. Milestones gated by independent tests. Assistants are thin clients of the same tools. |
| Harness CLIs change (`openclaw@latest`, Hermes installer) | Observed-version recording, adapter per harness, native-interactive fallback with verification, and pinned compatibility notes in the catalog |
| Secret leakage through assistants or logs | No secret-accepting tool, a validator that rejects literals, broker-only secret UI, redaction tests in every suite (SC-005) |
| Users expect the agent to "just do it" in the terminal | Install skill stages commands, the engine requires review/TTY confirmation, and the docs state honestly that harness permissions govern agents |
| WSL handoff loses context | Non-secret resume record on the WSL side, keyed to the setup session; acceptance requires 100% restoration |
| Link rot across 110 components and 238 skills | Scheduled link check, explicit "no vendor docs" reasons, ownership in catalog metadata |
| `main` channel instability | Engine protocol handshake, a warning on the source card, release as the default |
| Verification costs (tokens, messages) | Opt-in tiers with disclosure and per-message approval |
| Extension `views/setup.ts` name collision with Spec 151 | Namespace the new wizard; regression-test Spec 151 setup cards |

## Owner gates

1. **G1**: Approve spec and plan, then research begins.
2. **G2**: Approve research, contracts and tasks, then implementation begins.
3. **G3**: Isolated VS Code preview of the built feature, then branch packaging and push.
4. **G4**: WSL and Windows gate qualification handoff.
5. **G5**: Merge, NetClaw release and Marketplace publication.

Each authorization is recorded in the spec's Assumptions with its date, following the Spec 152 practice.

## Complexity Tracking

| Added complexity | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| New Claw Plan format and engine | Three pathways must install identically; non-CLI users need journaled resume and machine-readable progress | Wrapping `install.sh --add` is not a scoped primitive (Spec 151 research) and offers no resume or structured events |
| Bootstrap bundled in the extension | At zero there is no checkout to run | Requiring `git clone` first defeats the feature |
| Canonical catalog | Cards, links, fields, estimates and joins need structured data | Free-text `catalog.sh` strings and `ENV_MAP` lack labels, classification, links and joins |
| Setup broker | Separate assistant processes must reach native secret entry and review UI | Letting assistants handle secrets or apply plans violates FR-027/FR-041 |
| Separate deployment workspace for Spec Kit | Keeps user claw specs out of the NetClaw source checkout they update | Writing into `specs/` would mix product development with deployments |
| Constitution XI amendment | The installer touchpoint moves to the catalog | Leaving XI stale would make coherence reviews inaccurate |
