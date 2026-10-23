# Jev Science Officer

Optional, advisory-only TypeSafe System One integration for NetClaw (spec 125).
Border authors questions from the user's task and member observations; Jev returns
typed judgments. It never executes a diagnostic, configures a device, grants an
approval, changes eligibility or replaces Border's explanation.

## Install and configure

Use NetClaw's optional Jev installer component or the operator settings CLI:

```sh
python3 scripts/jev-settings.py setup
python3 scripts/jev-settings.py status
```

For an isolated manual installation:

```sh
python3 -m venv mcp-servers/jev-mcp/.venv
mcp-servers/jev-mcp/.venv/bin/pip install -r mcp-servers/jev-mcp/requirements.txt
mcp-servers/jev-mcp/.venv/bin/python mcp-servers/jev-mcp/server.py --status
```

The server reads its process environment by default. Existing installations can
explicitly select their runtime file with `server.py --env-file /path/to/.env`;
the handoff/adoption command records that absolute path in the existing MCP entry.
This loads only known Jev settings, `TYPESAFE_API_KEY` and `GAIT_VENV`, interpreting
dotenv values literally without sourcing a shell or expanding variables. Selected
file values override matching inherited settings. The file must be an existing,
nonsymlink regular file; a missing/invalid explicit file stops startup instead of
silently falling back. Unrelated environment variables are ignored. For a safe
configuration check, combine `--env-file /path/to/.env --status`.

`--status` and the `jev_status` tool never
call the provider; “ready” means configured, not a live health or accuracy check.

| Setting | Default / meaning |
| --- | --- |
| `JEV_ENABLED` | `false`; explicit opt-in required |
| `TYPESAFE_API_KEY` | Hosted credential; `JEV_API_KEY` is a fallback alias |
| `JEV_BASE_URL` | `https://api.typesafe.ai`; `/v1/systemone` appended when no path supplied; full custom paths accepted |
| `JEV_ENDPOINT` | Fallback alias for `JEV_BASE_URL` |
| `JEV_MODEL` | `jev-1.13.0`; response must report this exact model |
| `JEV_COMPATIBLE_API_KEY` | Separate optional compatible-service credential; hosted keys are never forwarded to custom endpoints |
| `JEV_COMPATIBLE_KEY_ENDPOINT` | Exact normalized endpoint binding required when a compatible-service key is configured |
| `JEV_DAILY_LIMIT_USD` | `5`; UTC day, shared across processes and tasks |
| `JEV_CASE_LIMIT_USD` | `0.25`; all calls for an originating task, across days |
| `JEV_INPUT_PRICE_PER_MILLION` | Hosted `0.042`; custom endpoints require an explicit value, including `0` for free local inference |
| `JEV_TIMEOUT_SECONDS` | `5`; absolute provider-call deadline, no automatic retries |
| `JEV_DATA_DIR` | `~/.openclaw/jev`; private directory (0700), rejects symlink state files |
| `JEV_TASK_ID` | Trusted runtime identity; takes precedence over operator settings |
| `JEV_GAIT_ROOT` | Current working directory; searches parents for `.gait` |
| `GAIT_VENV` | `~/.openclaw/gait-venv`; optional GAIT worker interpreter |

Operator `settings.json` supports `task_id`, `daily_limit_usd`,
`case_limit_usd`, and `case_overrides` keyed by task ID. These are privileged local
operator controls, not model-call arguments. Without a runtime/operator task ID,
all calls share the conservative `unscoped` task budget. Binding a task does not
erase its previous spend. General-purpose shell access must not be treated as a
security boundary: a process with operator filesystem privileges can edit settings.

## Tools

`jev_status()` returns secret-free settings, budget totals and safe latest-assessment
metadata. It also atomically updates `status.json` for the HUD. No state, question
text, provider response text or dynamic answer labels enter that browser snapshot.

`jev_evaluate(state, questions, purpose, evidence_metadata,
data_classification="sanitized", prepare_only=False, reconsideration_of=None)`
evaluates one text/object state against caller-authored question objects:

- Noul: `type: "noul"`, `instructions`, optional `criteria` with `true` and `false`
  descriptions. Returns `noul`, probability of yes.
- Choice: `type: "choice"`, `instructions`, `criteria` mapping 2–255 labels to
  descriptions. Returns selected label, full distribution and confidence.
- Score: `type: "score"`, `instructions`, `criteria` containing 2–10 ordered
  descriptions. Returns the probability-weighted level index, level distribution,
  legend and confidence. A Score is not an incident probability.

Instructions can be nonempty text, objects or arrays. Criteria must be descriptive
and nonempty. The service validates schemas and bounds, not semantic quality or
calibration. Questions are supplied dynamically; there are no static question packs.
Supported purposes are `evidence_review`, `specialist_advice`, `answer_review`,
`diagnostic_advice`, `change_review`, and `incident_triage`. The entire request is
bounded to 48,000 UTF-8 bytes and 64 questions.

`jev_assessment(assessment_id)` reads the original questions, typed result,
provenance, cost and audit status from the current task's local ledger. It cannot
read another task's records. A successful initial assessment can have one recorded
reconsideration in the same task; concurrent attempts cannot exceed that limit.

## Privacy and disclosure

Supply only sanitized, explicitly permitted evidence by default. Local secret
scanning checks structured credential keys and common configuration/credential
patterns across state, questions and provenance. This is defense in depth, not
proof of sanitization; Border and the human remain responsible for classification.
Detected credentials are rejected even with consent and even for loopback services.
Private classifications and detected address/configuration patterns require scoped
human approval before remote transmission. Private evidence may remain local at an
explicit loopback endpoint. Remote services require HTTPS; only explicit loopback
hosts may use HTTP. Redirects and environment-derived HTTP proxies are disabled.

Use `prepare_only=True` to obtain the digest, endpoint, trusted task ID and approval
requirement with **no provider call**. The operator's `approve-disclosure` command
creates a grant for that exact digest/destination/task, expiring by default after
five minutes. Changes to any bound request field invalidate the grant. A grant is
consumed atomically with the spend reservation, exactly once. There is no model tool
that issues approval. Approval of disclosure never approves network changes.

## Budget, failure and audit behavior

SQLite `BEGIN IMMEDIATE` transactions enforce daily and task caps across processes.
Every outbound attempt reserves 65,536 input tokens, the supported accounting
ceiling (about $0.002753 at hosted pricing), before sending. A valid usage response
reconciles to actual input usage; output is free under this configured pricing
contract. Missing/malformed usage, provider errors, interruption or timeout retain
the reservation because charging is unknown. The ledger survives process restarts.

Compatible endpoints must honor the configured input-only price and supported
65,536-token accounting ceiling. If a provider reports usage above that ceiling,
the actual reported charge is recorded and further calls are blocked pending
operator ledger review. Local caps cannot enforce a dishonest provider's external
billing or unannounced price changes; check provider billing limits as well.

Disabled, invalid request, disclosure approval required, budget exhausted, timeout,
unavailable and incompatible-provider states are explicit. No raw upstream error
body or credential is returned. Assessment failures never grant new authority.

`ledger.sqlite3` privately retains actual questions, evidence metadata, state digest,
typed answers, model, task and charge history; it does not retain the raw state.
The bounded GAIT worker writes an actual native private Turn using the available
GAIT environment. Results explicitly report `audit.gait.status="unavailable"` if
that recording cannot complete; the SQLite audit remains authoritative locally.
Border still records its own interpretation and resulting decision in its GAIT trail.

Validate offline with:

```sh
python3 -m pytest tests/unit/test_jev_core.py tests/unit/test_jev_stdio.py -q
```

Wire shapes follow the TypeSafe [Noul](https://docs.typesafe.ai/primitives/noul),
[Choice](https://docs.typesafe.ai/primitives/choice) and
[Score](https://docs.typesafe.ai/primitives/score) documentation. Successful transport
and schema checks do not establish network-domain accuracy or calibration.
