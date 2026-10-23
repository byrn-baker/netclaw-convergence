# Feature Specification: Local NetClaw Avatar and optional Tavus foundation

**Feature branch**: `144-tavus-netclaw-pal`
**Created**: 2026-10-09
**Status**: Closed for the local Avatar delivery under the owner's 2026-10-09 closeout/PR/merge instruction. Optional hosted Tavus remains experimental and disabled by default; outstanding hosted/expanded work is deferred, not accepted.
**Input**: Return from abandoned spec 143 to main; explore a conversational NetClaw Pal using Tavus and the existing API key, within the owner's Free plan.

## Closeout scope — 2026-10-09

This final scope supersedes the earlier hosted-first release gate below. Deliver
John and Lobster as the fourth Chat interface, shared Chat/model/history,
bounded authenticated macOS speech, browser animation and controls, and the
OpenClaw compatibility repairs needed by the existing HUD. The owner confirmed
the initial avatar/audio worked and requested closeout after the ten polish passes.

The optional Tavus code is an **experimental, disabled-by-default foundation**.
User Stories 1–3 and SC-001/SC-005 for hosted calls are deferred; they are not
claims of release acceptance. FR-014 applies to the delivered local slice;
hosted entitlement/billing/playback acceptance is still required before hosted
use can be called supported. Expanded own-key profiles, Border/member placement,
operational hosted reads, custom imports, microphone input and voice cloning need
separate follow-up specs. No paid plan or provider use is authorized by closeout.

Local acceptance is FR-001 and FR-016–020, preserved Chat authorization/ownership,
SC-006's applicable automated regressions, and the owner's initial live feedback.
Final polish viewport/speaker acceptance remains an explicit coverage gap.
See [verification](verification.md) for results and deferred work. Earlier
research and test records remain historical evidence.

## Ratified direction and implementation stages

**Local-first amendment (owner authorized 2026-10-09):** start with two selectable
local avatars: a stylized John based on the supplied portrait and a lobster.
Use the existing configured frontier-model chat path for answers, local speech
generation and browser animation. Tavus remains optional. Start with a system
voice; likeness and voice cloning are separate. First prove the two-character
formula, then add validated custom-avatar uploads or an external conversion
script. The initial local slice provides typed chat, audio playback and reactive
mouth/idle animation; dedicated speech recognition and phoneme alignment follow.

**Updated product scope:** the owner's subsequent five answers approve the
distribution/Border direction in [distribution-design.md](distribution-design.md):
Free default, optional custom media, owner-supplied keys, optional John media pack,
full authorized Border access and automatic non-sensitive summaries. These are
future requirements; they do not describe the implemented explanation-only slice.
The later local-first amendment above is now implemented as a prototype; Tavus
remains optional. No subscription upgrade or hosted training has been performed.

Build an optional **Pal** panel in the existing NetClaw HUD. Tavus supplies a stock face, speech recognition, turn-taking and speech playback. A local, authenticated bridge sends permitted requests to a constrained NetClaw agent session. Existing operational skills, memory and change workflows remain in the main NetClaw interface.

**Current slice (2026-10-09):** general explanations through a dedicated NetClaw agent with all tools denied and an isolated bootstrap workspace. Generated answers stay local until the operator explicitly selects **Speak this answer**, authorizing export of that exact displayed text. Automatic provider results contain only fixed non-sensitive notices. A browser-local smiley/lobster icon is supported; custom Tavus training remains excluded. This implements the foundation for User Stories 1 and 3. User Story 2 (scoped operational reads), live gateway/provider acceptance and release remain outstanding; no claim of a fully shipped feature follows from the local fixtures.

Start with Tavus's full pipeline and app-message tool delivery. This lets the browser reach both Tavus and the local HUD without exposing NetClaw to inbound Internet requests. The bridge is new work: neither an embedded video room nor a Tavus API key alone connects the agent.

Direct MCP and custom LLM connections are alternatives documented in [research.md](research.md). Their availability on this account remains unverified. Listing stock resources succeeded; no PAL, connector, tool or conversation was created.

## User Scenarios & Testing

### User Story 1 — Talk to NetClaw through a stock face (Priority: P1)

An authenticated operator explicitly starts a short Pal session, asks a general networking question or uses a synthetic lab scenario, and hears a response produced through NetClaw.

**Independent test**: One bounded call routes a synthetic question to an isolated NetClaw session and plays its approved answer, with a matching local task and audit record.

**Acceptance scenarios**:

1. Given an eligible account, confirmed remaining allowance and available gateway, starting Pal creates one private conversation using an eligible stock face.
2. Given a tool event, the server binds the conversation, operator and task before dispatch. The returned answer belongs to that task and is visibly attributed to NetClaw.
3. Given an unavailable gateway, the Pal reports unavailability; Tavus-generated filler or HUD fallback prose is never presented as observed network evidence.
4. Opening the panel, refreshing it or reconnecting does not silently create a billable conversation.

### User Story 2 — Investigate while keeping network evidence local (Priority: P1, later slice)

An operator selects an authorized target in the local HUD and requests an allowed read through Pal. Detailed findings appear locally. The avatar can say that findings are ready without receiving private network data.

**Independent test**: A synthetic tool result containing secrets, addresses and topology is available to the correct local operator, while the Tavus-bound payload contains only the permitted generic completion message.

**Acceptance scenarios**:

1. Device state comes from a real authorized observation, with source and time; unreachable and empty results remain distinct.
2. Private configurations, credentials, device identifiers, topology, raw tool output, RAG documents and memory do not cross into Tavus by default.
3. A write request is refused by execution policy and referred to the existing typed workflow. Spoken assent is not an approval.
4. Permission denial, replay, another operator's task ID or a revoked session cannot trigger a read or return evidence.

### User Story 3 — Keep the experiment within the Free allowance (Priority: P1)

The operator sees a conservative usage estimate and can end the call immediately.

**Independent test**: A fake provider and clock exercise exhaustion, duplicate starts, restart and ambiguous creation failures without consuming video time.

**Acceptance scenarios**:

1. A two-minute default session and five-minute hard maximum are enforced server-side; only one conversation can be active or reserved.
2. Calls cannot start when the verified remaining allowance is insufficient or unknown. A lost create response holds its reservation until reconciled.
3. End, navigation away, absent participant and backend recovery terminate or reconcile the provider conversation. UI disappearance alone is not completion.

### Edge Cases

- Interrupted speech or speculative inference must not duplicate an agent task.
- A slow investigation can outlive the call; the local task remains available, but no new video session starts automatically.
- Repeated or late tool results are matched by conversation and call ID; expired calls cannot speak into a newer conversation.
- Oversized app messages fail with a local explanation rather than silently dropping evidence or bypassing export controls.
- Out-of-band account use, billing-cycle changes, provider timeouts and process restarts invalidate stale budget assumptions.

## Requirements

### Functional Requirements

- **FR-001**: Pal MUST be optional and disabled by default; Chat remains the default. Preserve Chat, Canvas, saved investigations and native OpenClaw navigation.
- **FR-002**: Free MUST remain the default. Current live experimentation is limited to stock faces and verified Free allowance, with no upgrade or paid training authorized. The expanded product may offer custom face/voice for entitled accounts with explicit bounded training/usage admission. Cap Free experimental use at the smaller of 1,200 seconds and confirmed account remainder; never infer an automatic reset.
- **FR-003**: Use a durable, atomic account-wide budget ledger, conservative reservations, provider-side maximum duration and explicit end calls. Account for minimum billing, rounding, startup/cleanup and external use; unknown usage fails closed. See the proposed algorithm in [plan.md](plan.md).
- **FR-004**: Keep `TAVUS_API_KEY` and gateway credentials server-side. Only short-lived room credentials reach the authenticated client; redact them from logs, URLs and analytics. Use private rooms and existing HUD access controls.
- **FR-005**: Bind every call to its authenticated operator, conversation and server-selected agent session. Do not accept a client-selected gateway key, arbitrary endpoint, model override, tool name, shell command or target outside the selected scope.
- **FR-006**: Network-facing capabilities MUST remain MCP-native. The implemented first slice denies all agent tools. Expanded operational access MUST enter through the authenticated owner's Border and existing scope/tool policy. Provider work may run locally on Border or on an enrolled Tavus member; the member cannot become an unrestricted human ingress or approval authority. Prompt instructions and unrestricted chat dispatch alone are insufficient.
- **FR-007**: The first slice exposes no operational writes. Expanded Pal may request full authorized NetClaw work through Border, but existing production and Terminal Intent Local/Lab approval, baseline and verification gates remain authoritative. Speech never creates approval, changes a question into write intent, or bypasses confirmation required for quarantine/external communications.
- **FR-008**: Automatic outbound text MUST pass a deterministic allowlist/projection. The first slice permits fixed non-sensitive notices and exact stored-answer export via **Speak this answer**. Expanded automatic speech may include typed non-sensitive summaries and public explanations with no private evidence in their context. Private details stay local; arbitrary LLM redaction is not an export boundary. Test the expanded contract before enabling it.
- **FR-009**: Disclose that microphone audio, and camera video when enabled, travel to Tavus. Camera and screen share default off; recording and Tavus memory/document ingestion stay off. Disabling recording is not a promise of zero provider retention.
- **FR-010**: Disable speculative inference for dispatch, deduplicate tool events, enforce per-session concurrency, bound payloads and task deadlines, and handle cancellation without claiming an already-running tool was undone.
- **FR-011**: Voice answers use a verified NetClaw result or explicit unavailability. Long work gets a factual pending notice. Keep evidence links local. Test result playback semantics before promising verbatim delivery.
- **FR-012**: Preserve GAIT and local session attribution. GAIT failure disables operational dispatch; no fabricated success. Store usage, lifecycle and sanitized correlation metadata locally without provider tokens or unnecessary raw transcripts.
- **FR-013**: Verify account eligibility for PAL creation, tools and the selected stock face before live acceptance. A listed face is not proof that every face/model is included. If an essential feature is paid or unavailable, stop and report it; never silently upgrade.
- **FR-014**: Complete installer, configuration, HUD, skill and documentation coherence before describing Pal as shipped. Local implementation does not establish live acceptance; choose a release version after that acceptance.
- **FR-015**: Separate avatar profile, provider account and Claw binding. Each owner supplies their own provider key; the optional approved John media pack never includes secrets or grants access to John's Claw. Provider IDs require account-specific validation; a John profile on another installation speaks for that installation's authorized Claw.
- **FR-016**: Local Pal MUST offer John and Lobster on the same rendering and speech path. Reuse the existing authenticated Chat conversation, configured model, history and approvals; switching avatar/view must not reset or fork the chat. The local path must never instantiate Tavus or send speech to an avatar provider.
- **FR-017**: Local voice generation MUST use bounded, authenticated local synthesis with no shell interpolation or user-selected command/path. Playback and animation stop on navigation, hidden page, avatar switch and interruption. Voice unavailability must be explicit; never fall back silently to hosted synthesis.
- **FR-018**: Default automatic speech contains fixed non-sensitive status summaries. Full local answer playback requires an explicit action or clearly labeled opt-in; synthesis remains local. Asset format v1 is documented but arbitrary custom uploads are deferred until validation/compatibility tests pass.
- **FR-019**: Avatar MUST be the fourth Chat interface beside Chat, Canvas and OpenClaw, without a separate Pal sidebar destination. Desktop places the avatar left and chat right, selector below, with rotation, pan, zoom and reset controls. Narrow screens may stack responsively.
- **FR-020**: Local Avatar MUST expose truthful voice state, preserve per-tab quiet/full/summary preferences, offer bounded speech speed and volume, stop queued clips on interruption, support keyboard camera controls and reduced motion, and recover graphics loss without resetting Chat. Full reading may use sequential clips of at most 1,800 characters, with an 8,000-character spoken-text cap; default notices never include answer content.

### Key Entities

- **PalSession**: operator binding, provider conversation, local agent session, permitted scope, state, deadlines and usage reservation.
- **PalTurn**: conversation/call ID, idempotency digest, local task, evidence references, export disposition and completion state.
- **UsageLedger**: provider account and confirmed period, allowance evidence, external-use adjustment, reservations, conservative consumption and reconciliation time.
- **ExportDecision**: locally retained reason and approved outward text; private evidence is referenced locally, never serialized into the provider event.

## Success Criteria

- **SC-001**: One explicitly started, at most 120-second synthetic call completes a NetClaw round trip and confirmed provider cleanup within the reserved allowance.
- **SC-002**: Automated fixtures prove zero dispatch for unauthorized, duplicate, revoked and out-of-scope requests. The first slice rejects all writes; expanded Border integration must prove existing approvals cannot be bypassed.
- **SC-003**: Sensitive fixtures never appear in automatic Tavus-bound bodies, browser logs or unrelated sessions. Explicit speech approval releases only the exact reviewed stored answer.
- **SC-004**: Budget tests cover concurrent starts, exhaustion, external use, failed creation, lost responses, crash recovery, end failure and rounding; none oversubscribe the budget.
- **SC-005**: Report measured response and cleanup latency from the bounded trial. No untested real-time latency guarantee.
- **SC-006**: Applicable existing HUD/authentication regressions and repository artifact checks pass before release.

## Assumptions and Remaining Verification

- First-slice implementation and expanded product design are authorized. Custom face/voice support is in the expanded design; actual paid upgrades/training and live acceptance without verified allowance remain unauthorized. Local Blender feasibility is being explored.
- Tavus usage and the existing NetClaw model bill are separate. Free Tavus minutes do not make a paid NetClaw LLM free; use existing authorized budget or a configured local model.
- Account plan/remainder, creation entitlements, provider billing timing and the selected transport require verification before live acceptance.
- Startup device inventory initially lacked the testbed environment; retrying with the configured testbed failed on unsupported `connections.defaults.arguments`. No live device evidence was collected. MemPalace's configured script is missing.
- Public source details and read-only account evidence are in [research.md](research.md); current implementation status is in [tasks.md](tasks.md).
