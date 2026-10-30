---
description: NetClaw deployment implement through native setup review
---

# Implement a NetClaw deployment

NETCLAW_DEPLOYMENT_PRESET_153_V1

This is a deployment workspace, not the NetClaw development repository. Read the shared netclaw-install skill. Use only the provisioning MCP tools. No command in this workflow authorizes executing scripts/install.sh, another installer, an arbitrary command, apply, resume or cleanup. Never collect secrets in chat or files. Native secret entry returns presence only. Existing installations are preserved; new homes are independent.

Use deployment-spec.md, netclaw-plan.json, deployment-tasks.md, analysis.md and the default redacted claw-report.json. Required choices remain explicit; assumptions and unresolved decisions block apply. Source and host are reviewed in native setup. Production stays blocked when mandatory controls are unsupported or unverified. Do not substitute requested settings for observed enforcement. Every runtime/verification claim must identify actual evidence and limits.

Require an analysis with no unresolved findings and the current validated planRef/hash. Call netclaw_setup_review to stage that exact plan. The human applies through Review installation in the visible editor. Poll netclaw_setup_status without auto-resume. Record actual outcomes; use native redacted report write-back to claw-report.json. If no native editor is present, stop execution and explain how to reopen it. Never run the installer or infer approval from the word implement.

User input: $ARGUMENTS
