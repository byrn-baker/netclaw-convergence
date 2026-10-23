# WSL RISK adoption — Jev Science Officer (spec125)

## Readiness and objective

The feature works in local tests and a real hosted Jev call. It is **ready for controlled WSL adoption**, not yet certified as deployed on this WSL RISK or calibrated for production network judgments. Finish the acceptance checklist below before calling that installation complete.

Add the optional advisor to the existing Border without recreating the RISK, changing enrollment/certificates, replacing the Border persona, flattening its curated skill set, or touching CML device configurations. Preserve Adam's existing canvas. Only basic HUD status wiring belongs to125; see [HUD handoff](hud-handoff.md).

Read `SOUL.md`, `USER.md`, `TOOLS.md`, the latest daily memory and this spec. Start/check out a GAIT session branch, list the current pyATS inventory and check for incomplete changes. Spec124's completed adoption is background evidence, not permission to repeat its broad migration.

## 1. Adopt the merged source

Use the existing WSL checkout as its ordinary owner. Inspect local changes first; preserve them before switching branches. Once clean or safely isolated:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

Confirm merged main includes `scripts/jev-adopt.py`, `scripts/jev-border-adopt.py`, `scripts/jev-settings.py`, `mcp-servers/jev-mcp/` and this handoff. If the spec125 PR has not merged, stop at source preparation; do not assume a local Mac branch is remotely available. The completion message supplies the PR and merge revision. Do not copy macOS virtualenvs or private .env files through Git.

## 2. Discover the actual Border paths and preserve state

Inspect the running Border's user service/profile and active configuration locally. With the **same profile/state directory as that Border**, use `openclaw config file`, `openclaw config validate`, `openclaw mcp --help`, and gateway status. Do not assume the default `~/.openclaw` is the Border's home. Do not print full service environments or configurations into public evidence.

Set these shell variables to the discovered paths, not guessed defaults:

- `BORDER_CONFIG`: active Border OpenClaw configuration.
- `BORDER_WORKSPACE`: the workspace selected by that configuration.
- `JEV_ENV`: private env file to hold this advisor's settings/key; can be the appropriate existing runtime env.
- `JEV_DATA_DIR`: one shared persistent directory for this Border's budgets, assessments and consent.

Record baseline gateway/MCP discovery, RISK identity/member inventory and service states. Privately back up the selected config/env/persona plus existing Jev state if present. Quiesce Jev calls before backing up an existing ledger; use SQLite's backup facility or a stopped service for a coherent copy. Preserve testbeds, RAG/memory, credentials, sessions and enrollment material. The targeted adopters also create private recovery originals and refuse conflicting customizations.

The automated MCP adopter supports a current **existing `mcp.servers` registry**. It deliberately refuses legacy `mcpServers`, missing/ambiguous shapes and a different existing Jev registration. Use the installed runtime's schema/help to resolve such a refusal; never force the repository template over a live config.

## 3. Install only Jev's isolated dependencies and settings

For an existing curated RISK, use the targeted path below. The broad installer `--add jev` also deploys the global skill set; it alone does not register a new tool in an existing Border config. Do not run the whole installer merely to refresh this advisor.

From the merged checkout:

```bash
python3 -m venv mcp-servers/jev-mcp/.venv
mcp-servers/jev-mcp/.venv/bin/python -m pip install -r mcp-servers/jev-mcp/requirements.txt
python3 scripts/jev-settings.py --env-file "$JEV_ENV" --data-dir "$JEV_DATA_DIR" setup
```

Enable explicitly. Enter the key at the hidden prompt; never pass it as a command argument. A key existing on the Mac does not prove it exists on WSL. Keep defaults **$5/day** and **$0.25/task**, unless the operator chooses otherwise. Pin the model to `jev-1.13.0` for this acceptance. Hosted pricing defaults to $0.042/M input; compatible endpoints require explicit pricing and separate destination-bound credentials.

Persist the chosen `JEV_DATA_DIR` into that same env file so the MCP, settings CLI and HUD use the same ledger. Use the existing literal dotenv writer, not shell sourcing:

```bash
printf '%s' "$JEV_DATA_DIR" | python3 scripts/write-env.py "$JEV_ENV" JEV_DATA_DIR
python3 scripts/jev-settings.py --env-file "$JEV_ENV" --data-dir "$JEV_DATA_DIR" limits --daily 5 --case 0.25
python3 scripts/jev-settings.py --env-file "$JEV_ENV" --data-dir "$JEV_DATA_DIR" task cml-community-001
python3 scripts/jev-settings.py --env-file "$JEV_ENV" --data-dir "$JEV_DATA_DIR" status
```

An explicit runtime `JEV_TASK_ID` overrides the operator task setting. Resolve that intentionally; do not rotate IDs to evade budgets. Absent a trusted binding, all work shares `unscoped` and may stop earlier than distinct use-case accounting. Keep the same task across a complete CML build, member consultations and reconsideration. Bind a new task only for a genuinely new user task.

## 4. Preview and apply the two targeted adoptions

```bash
python3 scripts/jev-adopt.py --config "$BORDER_CONFIG" --env-file "$JEV_ENV"
python3 scripts/jev-border-adopt.py --workspace "$BORDER_WORKSPACE"
```

Review the scope: one MCP registration, one marked Science Officer section, six Jev skills and the guide. Stop on a customization/conflict refusal; preserve and reconcile it rather than overwriting it.

```bash
python3 scripts/jev-adopt.py --config "$BORDER_CONFIG" --env-file "$JEV_ENV" --apply
python3 scripts/jev-border-adopt.py --workspace "$BORDER_WORKSPACE" --apply
```

The registered process uses absolute checkout/interpreter paths and loads the selected env file as data. Keys remain in the env file, not the MCP registration. Keep this checkout at its registered path.

**Do not run `in2n-border-workspace.py` against an existing customized workspace:** it writes the full SOUL/IDENTITY, and omitted member flags default to empty. Do not run `register-all-mcps.py`: it registers everything and can select the system interpreter instead of Jev's isolated one.

## 5. Validate the actual runtime and reload narrowly

Using the active Border profile/config, validate with `openclaw config validate`. Discover the installed `openclaw mcp probe` and `reload` syntax; probe only `jev-mcp`, not every provider. Confirm exactly `jev_status`, `jev_evaluate` and `jev_assessment` are discoverable. `jev_status` does not call the provider.

Reload the affected MCP through the running Border or restart only its discovered gateway user service if needed. A separate CLI profile/cache is not proof the running gateway reloaded. Start a fresh Border conversation so the updated persona/skills are loaded. Preserve member services and the mesh; no enrollment or network configuration is required.

For the basic HUD feed, ensure its process uses the same `JEV_DATA_DIR`. The HUD does not infer an arbitrary Border home from `OPENCLAW_HOME`. Refresh `jev_status`, then check the existing RISK card without redesign work. Its configured/stale status is a local snapshot, not a live provider-health guarantee.

## 6. WSL acceptance — all must be observed

- [ ] Configuration validates; unrelated config fields and Border identity/member strings are preserved.
- [ ] RISK member inventory, gateway health, existing selected MCPs and relevant services remain healthy.
- [ ] The active Border discovers the three Jev tools and the six advisory skills.
- [ ] `jev_status` reports the intended endpoint/model/task and $5/$0.25 limits without exposing keys.
- [ ] One **synthetic** mixed Noul/Choice/Score call succeeds through the actual Border path; save sanitized usage, cost, model, assessment ID and GAIT status. Keep this acceptance below $0.01; no private topology required.
- [ ] Read back that assessment; restart/reload the MCP and confirm spending persists.
- [ ] A disabled fixture sends no provider request; budget refusal/approval binding/reconsideration checks pass offline rather than spending money to hit a cap.
- [ ] In a fresh real Border task, observe at least one dynamically authored consequential/final-summary consultation and a concise explanation of its influence. Merely displaying a card does not prove consultation.
- [ ] Public evidence contains no keys, private configs or topology. Private hosted evidence requires exact scoped consent; do not grant blanket disclosure for the demo.
- [ ] Basic HUD snapshot reads the same ledger; Adam's canvas remains functional.
- [ ] Record WSL results and remaining limitations in GAIT/daily memory. Only then mark WSL adoption complete.

The existing CML prompts are in [cml-demo-prompts.md](cml-demo-prompts.md). They assume the human resets only intended lab configuration and preserves management bootstrap. Do not wipe or configure devices as part of this installation handoff.

## Recovery

Disable Jev in the selected env and reload its actual MCP/gateway. Existing workflows remain available; keep the ledger for audit. Configuration restore is preview-first and refuses changes made since adoption:

```bash
python3 scripts/jev-settings.py --env-file "$JEV_ENV" --data-dir "$JEV_DATA_DIR" disable
python3 scripts/jev-adopt.py --config "$BORDER_CONFIG" --restore
python3 scripts/jev-adopt.py --config "$BORDER_CONFIG" --restore --apply
```

For persona/skills, use the exact recovery JSON printed by `jev-border-adopt.py --apply`:

```bash
python3 scripts/jev-border-adopt.py --workspace "$BORDER_WORKSPACE" --restore "$JEV_RECOVERY_JSON"
```

That command restores directly after preflight and refuses any intervening change. Do not force it past a refusal. Validate config and reload the affected runtime afterward; do not remove enrollment, memory, testbeds or unrelated components.

## Paste into the WSL Codex session

> Adopt merged spec125 Jev Science Officer into my existing WSL RISK. Read specs/125-jev-science-officer/wsl-handoff.md and verification.md first. Discover the active Border config/workspace/env/service; do not assume defaults or recreate my RISK. Follow the targeted dependency, settings, MCP and persona/skills adoption previews, preserve existing state and use the scoped recovery journals. I authorize the described Jev-only adoption and a frugal synthetic acceptance call below $0.01; use my local key privately. Keep $5/day and $0.25/use-case defaults unless I change them. Prove tool access and dynamic consultation through the actual Border, persistence across reload and unchanged member health. No device configuration, CML wipe or publishing. Keep HUD work to basic wiring; Adam's detailed Science Officer data views are for the next HUD. Finish with the WSL acceptance evidence and GAIT log; do not report100% if any acceptance item remains unverified.
