# Documented channel inventory

Checked **2026-10-25**. This is a reference inventory for [Spec155](spec.md), not a claim that the NetClaw installer supports or has tested every entry. [Machine-readable inventory](channel-inventory.json).

## OpenClaw

The [current channel index](https://docs.openclaw.ai/channels) lists **33 channels**. Its installation classes are recorded below. The [installer-pinned source documentation](https://github.com/openclaw/openclaw/blob/0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c/docs/channels/index.md) differs; “not listed” is a documentation difference, not proof that an adapter is technically impossible. Spec153 pins OpenClaw `2026.7.1-2`.

| Channel and official reference | Current index class | In pinned index | Spec153 installer |
| --- | --- | --- | --- |
| [A2A](https://docs.openclaw.ai/channels/a2a) | bundled | No | Absent |
| [Buzz](https://docs.openclaw.ai/channels/buzz) | official-plugin | No | Absent |
| [ClickClack](https://docs.openclaw.ai/channels/clickclack) | official-plugin | No | Absent |
| [Discord](https://docs.openclaw.ai/channels/discord) | official-plugin | Yes | Basic token setup |
| [Feishu](https://docs.openclaw.ai/channels/feishu) | official-plugin | Yes | Absent |
| [Google Chat](https://docs.openclaw.ai/channels/googlechat) | official-plugin | Yes | Absent |
| [iMessage](https://docs.openclaw.ai/channels/imessage) | official-plugin | Yes | Absent |
| [IRC](https://docs.openclaw.ai/channels/irc) | official-plugin | Yes | Absent |
| [LINE](https://docs.openclaw.ai/channels/line) | official-plugin | Yes | Absent |
| [Matrix](https://docs.openclaw.ai/channels/matrix) | official-plugin | Yes | Absent |
| [Mattermost](https://docs.openclaw.ai/channels/mattermost) | official-plugin | Yes | Absent |
| [Microsoft Teams](https://docs.openclaw.ai/channels/msteams) | official-plugin | Yes | Absent |
| [Nextcloud Talk](https://docs.openclaw.ai/channels/nextcloud-talk) | official-plugin | Yes | Absent |
| [Nostr](https://docs.openclaw.ai/channels/nostr) | official-plugin | Yes | Absent |
| [QQ bot](https://docs.openclaw.ai/channels/qqbot) | official-plugin | Yes | Absent |
| [Raft](https://docs.openclaw.ai/channels/raft) | official-plugin | Yes | Absent |
| [Reef](https://docs.openclaw.ai/channels/reef) | bundled | No | Absent |
| [Signal](https://docs.openclaw.ai/channels/signal) | official-plugin | Yes | Absent |
| [Slack](https://docs.openclaw.ai/channels/slack) | official-plugin | Yes | Basic token setup |
| [SMS (Twilio)](https://docs.openclaw.ai/channels/sms) | official-plugin | Yes | Absent |
| [Synology Chat](https://docs.openclaw.ai/channels/synology-chat) | official-plugin | Yes | Absent |
| [Telegram](https://docs.openclaw.ai/channels/telegram) | bundled | Yes | Basic token setup |
| [Tlon](https://docs.openclaw.ai/channels/tlon) | official-plugin | Yes | Absent |
| [Twitch](https://docs.openclaw.ai/channels/twitch) | official-plugin | Yes | Absent |
| [WebChat](https://docs.openclaw.ai/web/webchat) | core | Yes | Native UI; no channel choice |
| [WeChat](https://docs.openclaw.ai/channels/wechat) | external-plugin | Yes | Absent |
| [WeCom](https://docs.openclaw.ai/channels/wecom) | external-plugin | No | Absent |
| [WhatsApp](https://docs.openclaw.ai/channels/whatsapp) | official-plugin | Yes | Absent |
| [X / Twitter](https://docs.openclaw.ai/channels/x) | bundled | No | Absent |
| [Yuanbao](https://docs.openclaw.ai/channels/yuanbao) | external-plugin | Yes | Absent |
| [Zalo](https://docs.openclaw.ai/channels/zalo) | official-plugin | Yes | Absent |
| [Zalo ClawBot](https://docs.openclaw.ai/channels/zaloclawbot) | external-plugin | Yes | Absent |
| [Zalo personal](https://docs.openclaw.ai/channels/zalouser) | official-plugin | Yes | Absent |

## Hermes

The [current comparison](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) has **28 messaging platforms**, also present in the [pinned v0.21.6 documentation](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/website/docs/user-guide/messaging/index.md). Each linked guide is a separate reference; native support, plugin requirements and actual installation readiness must be checked independently. Home Assistant is documented as a plugin.

| Platform and official reference | Spec153 installer |
| --- | --- |
| [Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram) | Tokens only; messaging service missing |
| [Discord](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord) | Tokens only; messaging service missing |
| [Slack](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack) | Tokens only; messaging service missing |
| [Google Chat](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/google_chat) | Absent |
| [WhatsApp](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp) | Absent |
| [WhatsApp Business (Cloud API)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud) | Absent |
| [Signal](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/signal) | Absent |
| [SMS (Twilio)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/sms) | Absent |
| [Email](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/email) | Absent |
| [Home Assistant](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/homeassistant) | Absent |
| [Mattermost](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/mattermost) | Absent |
| [Matrix](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix) | Absent |
| [DingTalk](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/dingtalk) | Absent |
| [Feishu / Lark](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/feishu) | Absent |
| [WeCom (Enterprise WeChat)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom) | Absent |
| [WeCom Callback (Self-Built App)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom-callback) | Absent |
| [Weixin (WeChat)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin) | Absent |
| [BlueBubbles (iMessage)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/bluebubbles) | Absent |
| [Photon iMessage](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/photon) | Absent |
| [QQ Bot](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/qqbot) | Absent |
| [Yuanbao](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/yuanbao) | Absent |
| [Microsoft Teams](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/teams) | Absent |
| [LINE](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/line) | Absent |
| [ntfy](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/ntfy) | Absent |
| [SimpleX Chat](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/simplex) | Absent |
| [Raft](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/raft) | Absent |
| [IRC](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/irc) | Absent |
| [Buzz](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/buzz) | Absent |

## Additional interfaces and compatibility references

These remain visible in the specification but are not silently counted as interchangeable human chat platforms. A2A and Reef in the OpenClaw index also require an agent-protocol description; their presence does not expand this work into network-operation qualification.

| Runtime | Reference | Kind |
| --- | --- | --- |
| openclaw | [Voice call plugin (including Twilio)](https://docs.openclaw.ai/plugins/voice-call) | related-telephony-plugin |
| openclaw | [BlueBubbles removal and the imsg iMessage path](https://docs.openclaw.ai/announcements/bluebubbles-imessage) | retired-path-reference |
| hermes | [Optional telephony skill (Twilio)](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/optional-skills/productivity/telephony/SKILL.md) | related-optional-telephony-skill |
| hermes | [Open WebUI](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/open-webui) | browser-api-interface |
| hermes | [A2A (Agent-to-Agent)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/a2a) | agent-protocol |
| hermes | [Webhooks](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks) | event-ingress |
| hermes | [Hermes Relay](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/relay) | connector-transport |
| hermes | [Teams Meetings](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/teams-meetings) | meeting-workflow |
| hermes | [Microsoft Graph Webhook Listener](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/msgraph-webhook) | microsoft-365-event-ingress |
| openclaw | [Webex](https://github.com/JimiHFord/openclaw-webex/blob/1bc3274f262f946e0929de501d0d40c48bf3ef5a/src/plugin.ts) | explicitly-requested-external-plugin |

Webex is explicitly requested and already appears in NetClaw’s catalog, but the pinned OpenClaw plugin is blocked for API incompatibility. It is absent from both current upstream platform indexes. A compatible external integration must be qualified; it must not be represented as a native Hermes channel. [Webex bot documentation](https://developer.webex.com/messaging/docs/bots).

OpenClaw’s [BlueBubbles migration notice](https://docs.openclaw.ai/announcements/bluebubbles-imessage) and Hermes’s [BlueBubbles guide](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/bluebubbles) must remain distinct. Neither runtime’s support can be inferred from the other. Voice Call, Teams Meetings, Graph events, browser/API frontends and relay transports need their own effect and readiness descriptions.

## Twilio — explicit provider coverage

Twilio is explicitly in scope and searchable by name. It is the provider behind the existing SMS inventory entries, not an additional platform counted twice.

| Runtime | Documented path | Setup distinction |
| --- | --- | --- |
| OpenClaw | [SMS](https://docs.openclaw.ai/channels/sms) | SMS plugin; capable sender number or Messaging Service, private account credentials and a signed public webhook. Current documentation also covers MMS; pinned compatibility must be checked. |
| OpenClaw | [Voice Call](https://docs.openclaw.ai/plugins/voice-call) | Separate optional plugin with Twilio as a voice provider; SMS and voice require distinct callback routes. |
| Hermes | [SMS (Twilio)](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/sms) | Messaging gateway with account credentials, a capable phone number, allowed senders and the configured public URL used for signature checks. |
| Hermes | [Optional telephony skill](https://github.com/NousResearch/hermes-agent/blob/818c13be1dc4fd28987e1e881a9408224afd4535/optional-skills/productivity/telephony/SKILL.md) | Separate SMS/MMS sending, SMS polling and direct outbound-call capability. This is not a realtime inbound voice gateway and does not establish SMS-gateway readiness. |

The spec requires guided account/sender selection, private credential entry, recipient scope and provider-side prerequisites, with any paid provisioning explicitly reviewed. Selecting SMS does not enable voice or assume MMS support. A shared number must retain separate routes and independently reported readiness. These are installer requirements, not authorization to buy a number, text a recipient or place a call.

[Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security) is the reference for authenticated callbacks. [Twilio delivery tracking](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status) distinguishes submission from later delivery evidence. An accepted message identifier alone must not be labelled delivered. Missing, duplicated or out-of-order callbacks must preserve an honest outcome without replaying a send.

## Existing NetClaw Comms integrations

These are additional discovery paths under **Comms**, not additions to either runtime's native-channel count. Both components already appear in NetClaw's [catalog](../../config/components/catalog.json), under **Voice & Social**; they are not missing implementations of the underlying Twilio/Zoom capabilities.

| Option | Existing source | Current installer role result | Required explanation in Comms |
| --- | --- | --- | --- |
| Twilio core MCP | [Registration](../../config/openclaw.json), [Twilio Labs MCP](https://github.com/twilio-labs/mcp) | Focused/member component accepted; Border component rejected | Messaging/call/account tools are distinct from an incoming SMS channel. |
| NetClaw Twilio Voice MCP | [Server guide](../../mcp-servers/twilio-voice-mcp/README.md), four skills below | Focused/member component accepted; full Border bundle rejected | Tool owner and incoming-voice service placement need separate setup; existing gateway/home assumptions need selected-runtime checks. |
| Zoom Meeting Intelligence | [Operator guide](../../docs/ZOOM-MEETING-INTELLIGENCE.md), [MCP guide](../../mcp-servers/zoom-rtms-mcp/README.md) | Focused/member component accepted; full Border bundle rejected | RTMS meeting input connects to a local Border bridge; this is an integration placement requirement, not evidence that any remote member is ready. |

Twilio skills: [outbound call](../../workspace/skills/twilio-outbound-call/SKILL.md), [inbound voice](../../workspace/skills/twilio-inbound-voice/SKILL.md), [daily briefing](../../workspace/skills/twilio-daily-briefing/SKILL.md), [emergency call](../../workspace/skills/twilio-emergency-call/SKILL.md). Zoom: [meeting context](../../workspace/skills/zoom-meeting-context/SKILL.md), whose historical lookup is distinct from automatic live-question recognition.

The [role investigation](research.md#netclaw-comms-and-role-placement) contains source evidence and pure validation results. There is no current Twilio/Zoom member preset. Guided explicit selection must expose the capability without disguising it as a different member role. Component eligibility is not a live compatibility claim.

Zoom's [official RTMS setup](https://developers.zoom.us/docs/rtms/meetings/getting-started/) covers app/scopes and account prerequisites; [official MCP documentation](https://developers.zoom.us/docs/mcp/servers/) covers a separate authenticated tool connection. NetClaw must reconcile these with its own actual connector implementation. Neither native runtime index lists Zoom, and this spec does not invent a native Zoom chat adapter.

## Coverage rule

The implementation must reconcile the complete documented inventory for each chosen runtime version, including version additions/removals and external plugins. Every entry must have a visible, justified disposition: guided setup, reviewed native handoff, blocked dependency, unsupported version/host, retired, or explicit incomplete implementation. An unimplemented adapter is an open task, not evidence of upstream incompatibility. No supported entry may silently disappear because the current installer only knows a small subset.

The inventory is a dated baseline. Planning must bind platform-specific instructions and requirements to immutable source/version evidence and refresh this inventory when choosing an updated runtime baseline. Runtime upgrades require their own review; documentation discovery never performs them.
