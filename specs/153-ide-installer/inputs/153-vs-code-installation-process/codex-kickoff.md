# Spec 153 kickoff prompt for Codex

Paste the block below into Codex from the root of an up-to-date `netclaw` checkout on `main`.

---

You are the build agent for NetClaw Spec 153, "IDE Installer — Zero to a Tested Claw or Risk". Follow the constitution (`.specify/memory/constitution.md`) and the repository's Spec Kit workflow exactly.

1. **Branch and feature setup.** Use the repository's Spec Kit git feature skill to create branch `153-ide-installer` from current `main`, with sequential numbering. Create `specs/153-ide-installer/` and point `.specify/feature.json` at it.
2. **Install the inputs.** Copy the provided `spec.md` and `plan.md` into that folder unchanged. Treat `spec.md` as the clarified specification; its owner decisions in Clarifications are binding. Treat `plan.md` as the authoritative plan input.
3. **Clarify only what is new.** Run `/speckit.clarify` only if you find a genuine ambiguity the Clarifications do not cover. Ask me at most five questions, each with your recommended answer.
4. **Plan.** Run `/speckit.plan` with `plan.md` as input. Keep its architecture and decisions. Produce `research.md` (R1–R16), `data-model.md`, the `contracts/` listed in the plan, and `quickstart.md`.
   - For every research item, verify against live, current sources: OpenClaw, Hermes, the VS Code APIs, WSL, Spec Kit, and the skill and MCP registration docs for Copilot, Claude Code and Codex. Cite them.
   - Record research outcomes in a "Research outcomes" section appended to `plan.md`.
   - If evidence says a plan decision is wrong, flag it with your proposed change instead of silently changing it.
5. **Tasks.** Run `/speckit.tasks`. Order tasks by milestones M0–M9. Give every milestone its stories' independent tests, and mark parallelizable tasks `[P]`.
6. **Analyze.** Run `/speckit.analyze` and fix every inconsistency across `spec.md`, `plan.md`, `research.md`, the contracts and `tasks.md`. Record the results in `analysis.md`.
7. **Stop at owner gate G2.** Do not run `/speckit.implement`. Report back:
   - a one-page summary;
   - the research decisions that changed or sharpened the plan;
   - open questions;
   - a risk list;
   - a proposed qualification schedule.

**Rules for the entire session**

- Never touch my real `~/.openclaw`, `~/.hermes`, runtime homes or existing checkouts. Use isolated fixture homes (temporary `HOME`) and disposable hosts only.
- Never put secret values in any file, plan, log, transcript or commit. Use secret references.
- No push, PR, merge, packaging for release or Marketplace publication without my explicit authorization.
- Keep a GAIT session log as the constitution requires. Draft `milestone-draft.md` locally only.
- Preserve backward compatibility: existing `install.sh` flags, TUI behavior and extension workflows must keep working.

---

## After G2 approval, send

> G2 approved for Spec 153. Record the authorization in the spec's Assumptions with today's date, then run `/speckit.implement` milestone by milestone. Stop at the end of each milestone with its exit evidence. Hold at G3 for an isolated VS Code preview before any packaging or push.
