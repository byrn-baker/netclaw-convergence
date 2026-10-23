# Spec 140: HUD access and chat workflows

Status: implemented; proposed for review with specs 135–139.

An operator must be able to reach the visual HUD from another computer through a chosen Ethernet IP, without an SSH tunnel. The default remains loopback. Explicit interface binding grants access to clients that can reach that interface; it does not add authentication.

Acceptance: HUD_HOST selects a concrete IP; HTTP and WebSocket requests through that IP work; arbitrary Host and Origin values remain denied; the API remains loopback and is reached through the UI proxy. Invalid or wildcard addresses fail startup. Existing localhost behavior and port overrides remain compatible.

Scope excludes Internet publishing, authentication, gateway binding and network-device operations. User explicitly requested Ethernet binding. No further clarification is required for a specific interface opt-in.

## Coordinated review scope

This unpublished interface spec was renumbered from 134 after upstream assigned 134 to NetClaw Dot. Historical upstream specs are unchanged. The branch combines interface/runtime compatibility with specs 135 (model selector), 136 (context and quotas), 137 (runtime Settings and refresh), 138 (available models and effort), and 139 (previous chats). See [release plan](release-plan.md) for the proposed coordinated release.
