# Research

- User explicitly selected “Canvas / OpenClaw switch, with OpenClaw in a separate tab.”
- Dashboard already maintains the Canvas iframe across navigation and Basic/Advanced changes. The existing Border chat header button can become a three-choice control without a second embedded client.
- Installed OpenClaw `dist/control-ui-CuoxgbYo.js` sends `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`. Embedding would require bypassing upstream protection. Native new-tab navigation is the supported approach selected by the user.
- Installed OpenClaw docs/web/control-ui.md identifies default port 18789 and optional gateway.controlUi.basePath. Gateway TLS configuration determines HTTPS. Reuse the HUD runtime config read and expose no authentication fields.
- HUD is loopback-only and uses SSH forwarding for remote access. A native link must remain loopback and requires its gateway port forwarded separately. No arbitrary public URL override needed for this scoped refinement.
- v1.0.0 is already published at 397a539. The final scope includes a new Chat interface and ships as 1.1.0 without replacing the existing tag. No inventory count changes.

User expanded scope to a third, standard back-and-forth Chat interface as default. This is now minor 1.1.0. Existing `/api/chat` accepts isolated messages plus hudThread; private bootstrap and task bindings already exist for Canvas and are reused, never shared global chat history. Response marks `fromGateway`; false can contain local fallback prose, which the new UI must not present as live evidence. Server forwards the latest 40 messages, so the UI must describe that context window.
