# Provisioning MCP tools

All inputs are closed JSON objects, bounded to 1 MiB overall; string/array bounds follow the plan schema. Unknown keys/secret patterns are rejected without echo. Every response is a typed redacted projection. No tool accepts secret values, review capabilities, shell fragments or arbitrary paths outside the user-selected plan workspace.

| Tool | Input schema (required unless marked optional) | Output | Annotations |
| --- | --- | --- | --- |
| netclaw_setup_observe | `{}` | host class, prerequisite states, existing-install count/symbolic identities, detection limits | readOnly=true, destructive=false, openWorld=false |
| netclaw_setup_catalog | `{query?:string, kind?:component/skill/profile, ids?:string[]}` | matching canonical descriptors, documented settings by key, provenance/limits | readOnly=true, destructive=false, openWorld=false |
| netclaw_setup_draft | `{plan:DraftInput}` | validation, assumptions/unresolved, planRef/hash; writes only approved plan location | readOnly=false, destructive=false, openWorld=false |
| netclaw_setup_validate | `{planRef:string}` | safe diagnostics, hash, apply eligibility | readOnly=true, destructive=false, openWorld=false |
| netclaw_setup_explain | `{planRef:string}` | effects, unresolved choices, estimates and consent requirements | readOnly=true, destructive=false, openWorld=false |
| netclaw_setup_secret_entry | `{planRef:string, owner:string, key:string}` | pending/present/absent only; opens native human password UI | readOnly=false, destructive=false, openWorld=false |
| netclaw_setup_review | `{planRef:string, expectedHash:string}` | submitted/canceled/changed plus request ID; native review controls later apply | readOnly=false, destructive=false, openWorld=false |
| netclaw_setup_status | `{runRef?:string}` | redacted phase/component/tier states, resumable/unknown/paused distinctions | readOnly=true, destructive=false, openWorld=false |

Errors: invalid_input, secret_input_refused, unknown_catalog_id, outside_plan_workspace, stale_plan, broker_unavailable, session_expired, unsupported_host, review_pending, not_authorized. Return a reason code and safe pointer; never return rejected content, broker credentials, native terminal output, files or private config.

No `apply`, `resume`, `cleanup`, generic command/file/environment tool exists. Assistant review submission may cause a visible human flow; it never waits for or returns an apply capability. Headless use permits catalog/validation/explanation of already permitted drafts only; secret/review operations require the current visible host. Native UI, not an MCP client confirmation, is the authority boundary. Test with a client set to auto-approve all tools.

`DraftInput` uses the Claw Plan's closed nested field definitions with omissions permitted for drafting only. Unknown keys, malformed provided values and secret fields are still refused. Missing choices produce explicit pointers and unresolved decisions; draft success never implies schema validity or apply eligibility. All saved drafts stay within the already user-selected location.
