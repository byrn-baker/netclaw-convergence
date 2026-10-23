# Research: Tavus NetClaw Pal

Date: 2026-10-09. This is source review plus authenticated GET preflight, not an end-to-end integration test.

## Feasibility

Yes: Tavus can provide a conversational face for NetClaw. A purpose-built bridge is still required for identity, scope, response attribution, data export and usage enforcement. Recommend a local HUD bridge first; retain direct MCP as an optional deployment route.

| Route | How it connects | Assessment |
| --- | --- | --- |
| Local app-message bridge | Tavus tool event → authenticated HUD → local MCP facade → constrained NetClaw session; permitted answer returns as tool result | Preferred prototype. Browser has outbound access to Tavus and local access to HUD; no public NetClaw listener. Tavus still processes conversation media and returned text. |
| Direct Tavus MCP connector | Tavus → reachable authenticated MCP facade → NetClaw | Supported platform concept. Needs external reachability and an account eligibility check. Never expose the complete operational MCP fleet. |
| Custom LLM | Tavus → compatible HTTPS `/chat/completions` adapter → NetClaw | Most direct way to make NetClaw generate every answer. Needs SSE, session binding, safe output handling and latency validation; the current HUD route is not a drop-in endpoint. |
| Echo | Local speech pipeline/agent → Tavus text or audio playback | Possible alternative, but requires separate speech recognition and turn-taking; more work for the initial experiment. |

### Official platform contracts

- [Tool delivery](https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool-delivery): app-message calls carry a call ID; return `conversation.tool_result` with that ID. Data-channel messages have a 4 KB limit and no hard app-message dispatch timeout. HTTPS delivery requires a public URL, has a maximum 60-second timeout, and offers signed callbacks. These are distinct transports.
- [Tool configuration](https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool): create reusable tools and attach them to a PAL. Explicitly set result behavior: the default is `fire_and_forget`. `response_in_result` is documented for verbatim playback; verify its app-message behavior in the bounded trial. `generate_response` lets the Tavus LLM paraphrase a result and therefore cannot promise exact NetClaw wording.
- [Custom LLM](https://docs.tavus.io/sections/conversational-video-interface/pal/llm): requires a model, base URL, credential and SSE chat completions. Disable default speculative inference for this integration. Deprecated inline tools under `layers.llm.tools` should not be used.
- [MCP connectors](https://docs.tavus.io/sections/conversational-video-interface/pal/mcp-connectors): connectors attach at PAL scope. Tools are included by default; explicitly restrict `layers.mcp.connector_tools`, and independently enforce the server's own allowlist. Background tasks have `agent_start`, `agent_update` and `agent_stop` events; updates are not final evidence.
- [Create connector](https://docs.tavus.io/api-reference/connectors/create-connector): supports OAuth and static authentication. A Tavus-hosted connector cannot execute NetClaw's local stdio processes; it needs a reachable server. The docs do not prove this account can create/use a connector for free.
- [Pipeline modes](https://docs.tavus.io/sections/conversational-video-interface/quickstart/pipeline-modes): full mode supplies the conversational stack; Echo bypasses speech recognition/perception. A compatible custom backend need not itself be an LLM.
- [Conversation creation](https://docs.tavus.io/api-reference/conversations/create-conversation), [private rooms](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/private-rooms), [duration controls](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/call-duration-and-timeout), and [end conversation](https://docs.tavus.io/api-reference/conversations/end-conversation): use `require_auth`, short-lived meeting tokens, duration/absence limits and the non-destructive end operation. The timeout guide's closing example confuses absence with inactivity; verify schema/runtime behavior and implement an independent local idle policy.

## Free boundaries

The owner's quoted Free plan matches the current [developer pricing section](https://www.tavus.io/pricing): stock faces, 20 conversational minutes and 42+ languages. Its comparison table lists one concurrent session, a five-minute call limit, a 30-second minimum charge and six-second usage increments. The table describes a monthly allowance, but this design does not replenish from the calendar alone. Confirm the account's actual cycle and remaining balance first. The page also contains older duplicated pricing sections; do not substitute their larger allowances.

Budget controls are proposed engineering safeguards, not a guarantee from an inventory API. Model, hosting or tunnel costs are separate. No paid service was activated during research.

## Authenticated read-only preflight

The key was loaded from repository `.env` in-process and sent only in the authentication header to the documented `https://tavusapi.com` host. Redirects were disabled. Secret values, user PAL prompts, conversation URLs and raw responses were not logged.

| GET | Observed result |
| --- | --- |
| `/v2/faces?face_type=system&limit=100` | HTTP 200; 100 returned, catalog total 150 |
| `/v2/pals?pal_type=system&limit=10` | HTTP 200; 10 returned, catalog total 31 |
| `/v2/conversations?limit=1` | HTTP 200; zero returned, total zero |

Sources for these reads: [List Faces](https://docs.tavus.io/api-reference/faces/list-faces), [List PALs](https://docs.tavus.io/api-reference/pals/list-pals), [List Conversations](https://docs.tavus.io/api-reference/conversations/get-conversations). [Sanitized evidence](evidence/account-preflight.json) records the observations. The response proves authentication and inventory access only. It does not establish remaining credits, absence of deleted historical usage, PAL/tool creation eligibility or entitlement to all returned faces. No mutation or conversation was performed.

## Existing NetClaw integration points

- [HUD server](../../ui/netclaw-visual/server.js), `POST /api/chat`: authenticated thread binding, gateway selection, model/effort handling and explicit `fromGateway` evidence flag. It currently sends `stream:false` and returns a HUD-specific JSON envelope. It also has an unbound compatibility path, which Pal must not use.
- [Chat transport](../../ui/netclaw-visual/src/hud-server/chat-transport.js): buffers the complete response and permits long deadlines; unsuitable unchanged for Tavus SSE or short voice latency.
- [Bindings](../../ui/netclaw-visual/src/hud-server/bindings.js): operator-owned tasks, private persistence and server-selected gateway keys. Reuse the ownership design, not caller-supplied session IDs.
- [Federation gateway](../../mcp-servers/protocol-mcp/bgp/federation/gateway.py): existing WebSocket agent dispatch; its header describes HTTP compatibility as absent, while the newer HUD conditionally supports it. This is a source discrepancy; runtime capability must be measured rather than inferred from either comment.
- Local runtime configuration contains gateway authentication, but no explicit `chatCompletions.enabled` value was observed. No gateway prompt or paid model invocation was made.
- [Constitution](../../.specify/memory/constitution.md): new tool integrations remain MCP-native. Use a local facade for the capability; browser/media transport is presentation plumbing. Production approval and the narrowly scoped Terminal Intent lab exception remain unchanged.

## Recommendation and open gates

Proceed to review the draft for the local HUD bridge. Before implementation/live acceptance, verify: account creation entitlements and allowance; SDK event interoperability; constrained agent enforcement; result playback; task and interruption behavior; provider usage/cleanup timing. Direct MCP and custom LLM should be evaluated only if a remotely reachable deployment is actually desired.

Keep the first call synthetic. Real private network details can be shown in the authenticated local HUD; making a hosted avatar speak those details necessarily exports them. Local credentials and local tools alone do not make Tavus speech private.

## Local own-voice decision — 2026-10-09, Ralph pass 9

Recommendation: benchmark **Qwen3-TTS 0.6B Base through MLX Audio** first on this
Apple Silicon Mac. Use reference-conditioned cloning before attempting training.
Qwen publishes the Base model as Apache-2.0 and supports cloning from a short
recording plus its transcript. Its documented three-second capability is a
model claim, not a guarantee of John's voice quality or this Mac's latency.
[Official Base model card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base).

MLX Audio documents Base-model inference with local `ref_audio` and `ref_text`;
CustomVoice selects preset speakers and is not the own-recording model variant.
The community's 8-bit Base conversion is also marked Apache-2.0. Start with the
0.6B model, then compare 1.7B only if quality justifies the measured cost. This is
an engineering recommendation, not a measured speed result on this host.
[MLX implementation guide](https://github.com/Blaizzy/mlx-audio/blob/main/docs/models/tts/qwen3-tts.md),
[8-bit conversion](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit).

Alternatives: **Chatterbox** supports reference-audio cloning, has MIT-marked
weights, and its repository documents CPU/MPS execution. It is a useful comparison
candidate. **F5-TTS** has MIT code but its supplied pretrained weights are
CC-BY-NC; do not assume the code license permits commercial redistribution of
those weights. Neither was installed or benchmarked during this pass.
[Chatterbox model](https://huggingface.co/ResembleAI/chatterbox),
[Chatterbox repository](https://github.com/resemble-ai/chatterbox),
[F5-TTS licensing](https://github.com/SWivid/F5-TTS#license).

### John's input and the next implementation slice

Capture a 60–120 second clean WAV master, then select a natural 10–20 second
excerpt and write its exact transcript. These are our practical recording
recommendations, not minimum training requirements. One speaker, quiet room,
no background music, ordinary conversational delivery. Use the script in
`docs/TAVUS-PAL.md`, with no private network information. Keep the master and
reference under `~/.openclaw/pal/voices/john/`, outside the repository and static
web root. An MP3 can be converted locally, but keep the original WAV if possible.
No reference file exists yet; no voice has been trained or uploaded.

The next slice should retain the current `localSpeech` adapter interface and
existing WAV playback/mouth animation. Add an isolated persistent MLX worker,
load a pinned model revision once, and pass bounded text plus an owner-selected
voice profile. Browser requests select opaque profile IDs, not arbitrary files,
commands or URLs. Keep files owner-scoped, preserve cancellation/deadlines, and
make model download/install explicit setup. Keep Apple voice as the visible
fallback with the selected engine shown. Never silently upload a recording.
John and Lobster can choose separate voices independently of their meshes.

Before enabling this in the HUD, measure cold start, warm synthesis time per
second of audio, peak RAM and cancellation on this 48 GiB Mac. Listen to greetings,
questions, numbers and network terms; compare against Apple voice. No universal
real-time promise. Prefer cached reference conditioning over fine-tuning until
these results show a concrete need for more training data. Model downloads and
local compute remain costs even when there is no avatar service bill; frontier
Chat model usage remains unchanged.

Distribution should keep the existing optional downloadable John media pack
separate from other owners' private recordings. Each owner explicitly selects
Apple voice, their own local reference, or an available approved pack. The pack
is not published yet. This pass produces a checked design and recording plan,
not a working clone, training run or new model dependency.
