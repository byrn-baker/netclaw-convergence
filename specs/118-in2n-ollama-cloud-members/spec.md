# Spec 118: iN2N Ollama Cloud Members

## Problem

The Border is configured (`N2N_ROLE=border`, `N2N_RISK_NAME=byrns-risk`) but only
one member (`guardian-claw`) is provisioned — and it references a stale model
(`ollama/voytas26/openclaw-qwen3vl-8b-opt`). All other domain work still runs
through the monolith Border on expensive `claude-sonnet-5`, defeating the entire
token-economy purpose of the Risk architecture.

The legacy `ollama-mcp` domain-expert router (env-var-driven
`NETCLAW_MODEL_CODER`/`NETCLAW_MODEL_FAST`) is obsolete — iN2N members replace it
entirely.

## Solution

Provision all 8 available members as separate OpenClaw agent processes, each with
its own Ollama Cloud model assignment, scoped MCP servers, and systemd service.
Remove the `ollama-mcp` from MCP registrations (it's no longer needed).

## Member Plan

| Member | Ollama Cloud Model | Skills (count) | Rationale |
|--------|--------------------|----------------|-----------|
| pyats | `nemotron-3-super:cloud` | 18 | Heavy structured CLI parsing, tool-call intensive — 120B MoE / 12B active designed for multi-agent |
| nautobot | `nemotron-3-nano:30b-cloud` | 1 | Simple structured API queries |
| network-guardian | `qwen3.5:27b-cloud` | 4 | Alert triage needs moderate reasoning |
| cml | `qwen3.5:27b-cloud` | 5 | Lab management needs reliable tool calls |
| suzieq | `nemotron-3-nano:30b-cloud` | 1 | Very narrow state queries |
| batfish | `nemotron-3-nano:30b-cloud` | 1 | Narrow config analysis tasks |
| viz | `gemma4:31b-cloud` | 8 | Multimodal, good for diagram/visualization |
| github | `nemotron-3-nano:30b-cloud` | 1 | Commit/PR operations are formulaic |

Border stays on `anthropic/claude-sonnet-5` for routing reliability.

## Changes Required

1. **Provision 7 new member homes** via `in2n-member-home.py` with Ollama Cloud
   model overrides (guardian-claw already exists, needs model update).
2. **Update guardian-claw** — replace stale model, remove `ollama-mcp` from its
   MCP server list.
3. **Update `in2n-profiles.py`** — add Ollama Cloud model support to `MCP_SERVERS`
   mappings (some members like `pyats` have empty MCP lists that need the
   `pyats-mcp` entry, and `network-guardian` still references `ollama-mcp`).
4. **Generate systemd services** for all members via `in2n-services.py`.
5. **Clean up `.env`** — remove stale `NETCLAW_MODEL_CODER`/`NETCLAW_MODEL_FAST`
   vars and the `devstral-2:123b` reference (retired model).
6. **Remove `ollama-mcp` from Border's `openclaw.json`** — no longer needed.

## Out of Scope

- DefenseClaw production enforcement (`N2N_RISK_MODE` stays `testing`)
- eN2N external peering changes
- Border model change (stays on Claude Sonnet 5)

## Dependencies

- Ollama Cloud account with API key (already configured in `.env`)
- OpenClaw installed and gateway running
- All MCP server backends configured (per `in2n-profiles.py list` output)
