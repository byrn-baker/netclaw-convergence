# Prospective Constitution XI amendment

Status: **draft only; not ratified**. Current constitution remains authoritative.

Proposed MINOR version: 1.3.0, subject to the normal constitution workflow. In XI's installer catalog bullet, add:

> `config/components/catalog.json` is the canonical source of component, profile, setting and documentation metadata. Generate and commit the corresponding `scripts/lib/catalog.sh` entry and profile membership; generator parity and complete installer coverage are required. Each installable component retains a self-contained `component_install_<id>()` or explicitly documented no-install adapter in `scripts/lib/install-steps.sh`.

Extend the coverage-check bullet to include schema, skill/server/card joins and the generated-shell parity check. All other touchpoints and safety rules remain in force.

This feature does not need an exception: it retains generated catalog entries, existing installer functions and the coverage check. Provisioning-mode tools extend the existing editor adapter rather than introducing an operational MCP integration. The M9 coherence matrix records applicability of README, HUD, SOUL, skill, env, TOOLS and runtime-config touchpoints; missing applicable artifacts block completion. No constitutional change is made by merely adding this draft.
