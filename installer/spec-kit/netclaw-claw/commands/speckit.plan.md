---
description: NetClaw deployment plan through native setup review
---

# Plan a NetClaw deployment

NETCLAW_DEPLOYMENT_PRESET_153_V1

This is a deployment workspace, not the NetClaw development repository. Read the shared netclaw-install skill. Use only the provisioning MCP tools. No command in this workflow authorizes executing scripts/install.sh, another installer, an arbitrary command, apply, resume or cleanup. Never collect secrets in chat or files. Native secret entry returns presence only. Existing installations are preserved; new homes are independent.

Use deployment-spec.md, netclaw-plan.json, deployment-tasks.md, analysis.md and the default redacted claw-report.json. Required choices remain explicit; assumptions and unresolved decisions block apply. Source and host are reviewed in native setup. Production stays blocked when mandatory controls are unsupported or unverified. Do not substitute requested settings for observed enforcement. Every runtime/verification claim must identify actual evidence and limits.

Read the deployment spec and canonical schema/catalog from the approved setup editor. Build netclaw-plan.json using scoped secret references only. Submit netclaw_setup_draft and record its planRef/hash. Call validation and explanation; record required settings and limitations. Native source selection must precede any executable source use. A draft is not installation approval.

User input: $ARGUMENTS
