---
description: NetClaw deployment analyze through native setup review
---

# Analyze a NetClaw deployment

NETCLAW_DEPLOYMENT_PRESET_153_V1

This is a deployment workspace, not the NetClaw development repository. Read the shared netclaw-install skill. Use only the provisioning MCP tools. No command in this workflow authorizes executing scripts/install.sh, another installer, an arbitrary command, apply, resume or cleanup. Never collect secrets in chat or files. Native secret entry returns presence only. Existing installations are preserved; new homes are independent.

Use deployment-spec.md, netclaw-plan.json, deployment-tasks.md, analysis.md and the default redacted claw-report.json. Required choices remain explicit; assumptions and unresolved decisions block apply. Source and host are reviewed in native setup. Production stays blocked when mandatory controls are unsupported or unverified. Do not substitute requested settings for observed enforcement. Every runtime/verification claim must identify actual evidence and limits.

Read deployment-spec.md, netclaw-plan.json and deployment-tasks.md. Validate the canonical draft and inspect explanation. Check missing/contradictory choices, paths/ports/service collisions, supported profiles, independent secret ownership, production control evidence and every verification requirement. Write analysis.md with findings; resolve all findings before review. Never declare readiness from prose alone.

User input: $ARGUMENTS
