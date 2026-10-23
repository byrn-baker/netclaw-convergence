# Terminal intent execution

**Ask NetClaw** submits the operator's goal to the existing tool-enabled OpenClaw
`main` agent. It is no longer a CLI-translation-only request. A clear instruction
such as “create a VPN tunnel between Example Edge and Example Core” requests discovery,
authorized configuration and verification across both named endpoints. It does
not require a second “make a proposal” request or a terminal Send checkbox.

## Execution boundary

Execution happens through the agent's installed NetClaw/pyATS tools and policies,
not by dumping generated CLI into the selected browser SSH session. The agent
needs working tool/device access and its existing change-management approvals.
Intent does not install tools or override tool-level permissions. Production
retains required ServiceNow approval. The explicit [Local/Lab workflow](LOCAL-LAB-CHANGE-CONTROL.md)
uses owner-designated endpoints, local approval/audit, a preparation/artifact gate
and verification instead of ServiceNow; it is disabled by default. Missing parameters/approvals/tool
access must return a concrete question or blocker instead of silently stopping.
The active device resolves “this router”; other inventory devices are context,
not implicit authorization. Credentials are not forwarded from testbed profiles.

The action path always uses NetClaw Gateway. Instant Assist remains available for
**Explain output**, which is analysis-only. Existing historical CLI proposals
retain their manual review path; new action requests use the execution path.

## Continuation and visible state

- API starts one tracked execution, browser polls its ID, and the agent pursues
  the request using its tools. Disconnected browser SSH does not block this path.
- The agent can report `in_progress`; the API then continues the same goal,
  preserving prior reports and requiring baseline-aware, non-repeated actions.
  Read-only prechecks alone are not accepted as a completed change report.
- Each run uses a dedicated Gateway session via the documented
  `x-openclaw-session-key` header (and stable `user` field).
  Continuation segments and answers to a retained blocked/question run reuse
  that session. Separate new goals get separate sessions, not a shared global chat.
- Genuine `needs_input` or `blocked` reports stop continuation. The user answers
  normally in the same intent conversation; recent goal/result context is retained.
- Maximum six work segments and a ten-minute gateway deadline. No automatic
  transport retry: a timeout may follow a successful write. Unknown outcomes
  explicitly require live-state inspection before another attempt.
- Elapsed time, work-segment count and agent reports remain visible. The same
  Intent conversation now includes a **Live execution activity** feed with
  timestamps, tool requests, returned output previews and agent-reported checks.
- Completion is labeled **Agent reports the requested outcome complete**. Change
  completion requires reported actions (or already-satisfied state) and reported
  verification, but is not an independent second verification by this UI.

## Live execution activity

On a local Gateway deployment, the API observes only the exact application-owned
session in `OPENCLAW_HOME/agents/main/sessions/sessions.json` and tails that
session's JSONL transcript read-only. It never selects the latest global session.
Existing bytes are skipped before a continuation starts; timestamp checks,
path containment, partial-line handling and bounded reads protect isolation.
No extra Gateway permissions, device commands or network connections are created.

Tool events are sampled every 750ms and delivered through the existing 1.5-second
run polling, subject to when Gateway writes transcript records. This is
near-real-time observation, not keystroke streaming or a progress percentage.
Tool requests do not prove a command executed; returned output does not prove
successful configuration. Agent reports are separately labeled. Internal
reasoning, prompts, arbitrary tool arguments and binary attachments are omitted.
Only familiar device/CLI argument fields are eligible for preview. Text with
common secret markers is withheld in full before truncation; this conservative
filter may also hide harmless output and is not a replacement for source-side
secret redaction. Tool output previews are limited to 5,000 characters; the feed
retains at most 200 events / 100,000 content characters per run.

The feed auto-follows by default. Scrolling upward pauses following; the checkbox
resumes it. Long output can be expanded inline. No fabricated activity is shown
during quiet periods. Missing/inaccessible/unsupported local transcripts (including
remote Gateways or tool work delegated into a different session) show an explicit
availability notice; submission events and segment reports still work. Activity
observer errors do not interrupt configuration or trigger retries. Observation
ends with the API job; an uncertain outcome can mean the Gateway is still working.

## Process/reload behavior

Localhost-only `POST /api/terminal/intent/runs` creates a request using a client
UUID. Repeat submissions of the same retained ID/payload do not execute twice;
conflicting payloads fail. One execution can be active at a time. The API retains
up to 100 in-memory records, without gateway credentials. Canvas saves the run ID
and polls rather than resubmitting after refresh. Closing a pane does not cancel
the agent. Restarting the API loses records, NOT proof that gateway/device work
stopped; missing records show an unknown outcome and never auto-replay.

Restart the NetClaw API and refresh Canvas to load this backend/frontend change.
The desktop API-only restart launcher can be used when no execution is active.
Valid JSON reports may be returned alone or in one fenced JSON block after prose;
multiple ambiguous report blocks remain uncertain. A blocked report is never
interpreted as successful execution.

## Verification

`npm run test:intent-execution` covers mock-gateway continuation, idempotency,
scope/approval contract, blockers, uncertainty, missing completion evidence,
work limits and HTTP origin guards. `npm run test:intent` covers explanation and
legacy proposal behavior. `/test/terminal-design.html` contains an explicitly
synthetic delayed execution/question fixture with no external/model/SSH access.
`npm run test:intent-live` covers exact-session isolation, prior-history exclusion,
partial writes, size bounds, secret/reasoning filtering, live events before the
HTTP response completes and unavailable-observer fallback. The synthetic preview
stages tool requests and results over time, all explicitly marked DEMO ONLY.
`npm run test:intent-live-ui` renders the actual JSX to check inline content,
evidence labels, expandable output, safe escaping and availability notices.
No live configuration is sent by these tests. Installed agent skills, credentials,
approvals and device-specific VPN outcomes still require deployment validation.
