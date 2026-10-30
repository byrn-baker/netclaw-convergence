# Deployment specification

## Intent and acceptance
[Describe requested outcome.]

## Required decisions
Host/source; Focused/Risk; per-claw harness, provider, model/API mode, channels; profiles/components/skills; separate homes, ports, services and trust domains; settings references; inventory/identity; posture; verification.

## Assumptions and unresolved decisions
[Keep every missing decision visible.]

NETCLAW_DEPLOYMENT_PRESET_153_V1

This is a deployment workspace, not the NetClaw development repository. Read the shared netclaw-install skill. Use only the provisioning MCP tools. No command in this workflow authorizes executing scripts/install.sh, another installer, an arbitrary command, apply, resume or cleanup. Never collect secrets in chat or files. Native secret entry returns presence only. Existing installations are preserved; new homes are independent.

Use deployment-spec.md, netclaw-plan.json, deployment-tasks.md, analysis.md and the default redacted claw-report.json. Required choices remain explicit; assumptions and unresolved decisions block apply. Source and host are reviewed in native setup. Production stays blocked when mandatory controls are unsupported or unverified. Do not substitute requested settings for observed enforcement. Every runtime/verification claim must identify actual evidence and limits.
