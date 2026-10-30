# Research: IDE Installer

**Date:** 2026-10-17. **State:** all sixteen research decisions resolved for design. This is source/documentation evidence, not runtime or platform acceptance.

| Research item | Decision and evidence |
| --- | --- |
| R1 Windows/WSL | [IDE research](research-notes/ide-assistants.md#r1--windows-gate-and-wsl-handoff): read-only native gate, byte-aware parser, explicit stateful reopen, verify Ubuntu 24.04/26.04 identity remotely. |
| R2 Harness onboarding | [Runtime research](research-notes/runtimes.md#r2--harness-onboarding-and-discovery): version-qualified adapters, native fallback with observed postconditions; Hermes guidance-only command is not an installer. |
| R3 Local providers | [Runtime research](research-notes/runtimes.md#r3--local-providers): explicit endpoint/model discovery, harness-specific API modes, size/hardware unknown states before download consent. |
| R4 Prerequisites | [Bootstrap research](research-notes/bootstrap-plan.md#r4--prerequisites-and-remedies): editor-runtime observation, fixed reviewed remedies, no hidden elevation/global runtime replacement. |
| R5 Source acquisition | [Bootstrap research](research-notes/bootstrap-plan.md#r5--source-acquisition-and-trust): published release default, labelled tag fallback, pinned origin/ref/commit/tree, nonexecuting protocol handshake. |
| R6 Plan | [Bootstrap research](research-notes/bootstrap-plan.md#r6--plan-format-validation-and-hashing): closed schema, strict stdlib subset, explicit canonical JSON v1, classified references, native authority. |
| R7 Engine | [Installer research](research-notes/installer.md#r7--engine-and-scoped-phase-bridge): fixed scoped bridge, private authoritative journal, OS locks, observed unknowns, disconnect checkpoints. |
| R8 Secrets | [Installer research](research-notes/installer.md#r8--secrets-and-writers): bounded stdin frames, isolated scopes, private atomic writers, output projection. |
| R9 Catalog | [Installer research](research-notes/installer.md#r9--canonical-catalog-and-completeness): one JSON source, generated shell parity, 110 components/237 skills, exact evidence-backed joins. |
| R10 Shape | [Installer research](research-notes/installer.md#r10--shape-advisor): transparent estimates, unknown coverage, declared trust domains, overrideable heuristics. |
| R11 Risk | [Runtime research](research-notes/runtimes.md#r11--single-host-mixed-harness-risks): per-claw ownership/providers/credentials; all pairings; scoped lifecycle and truthful qualification. |
| R12 Assistants | [IDE research](research-notes/ide-assistants.md#r12--assistant-surfaces-runtime-launch-skills-and-broker): editor executable, local broker, dedicated shared skill, no tool apply/secret values. |
| R13 Spec Kit | [IDE research](research-notes/ide-assistants.md#r13--spec-kit-07-preset-packaging): stable 0.7.1 preset outside source, resolved command checks, native review submission. |
| R14 Verification | [Runtime research](research-notes/runtimes.md#r14--verification-and-truthful-reports): identity-bound six tiers and Risk, consent, provenance, private/default export separation. |
| R15 Editor version | [IDE research](research-notes/ide-assistants.md#r15--vs-code-minimum): select >=1.109 for stable skills; document older-version upgrade without modifying saved installations. |
| R16 Cleanup | [Installer research](research-notes/installer.md#r16--cleanup): reviewed owned-artifact operations, revision checks, preserve ambiguous/shared/changed state. |

Each linked note includes primary URLs, accessed date, local evidence, rejected alternatives and limits. Corrections are adopted in the plan's **Research outcomes** and must be traced to tasks. No unresolved research item is concealed as an implementation default. Live host/client/provider qualification and usability recruitment are acceptance dependencies, explicitly separated from source research.
