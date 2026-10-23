# Feature Specification: Chat / Canvas / OpenClaw interfaces

**Branch**: `130-chat-interface-switch`
**Created**: 2026-09-28
**Status**: Accepted — user selected native OpenClaw in a separate tab and then requested standard Chat as the default

## User scenarios and acceptance

### User Story 1 — Choose a chat interface (P1)
An operator can choose standard Chat, Canvas or the native OpenClaw interface from the HUD header.

1. Canvas selection opens the existing embedded workspace.
2. OpenClaw opens the configured native Control UI in a separate tab; the original HUD and Canvas remain intact.
3. Returning to Canvas preserves the existing iframe, draft and session. Selected investigation context continues to target Canvas, not an unrelated OpenClaw session.

### User Story 2 — Honest, safe navigation (P1)
An operator can tell whether a link is configured, unavailable or disabled without exposing credentials or pretending the gateway is connected.

1. A configured gateway port, Control UI base path and TLS flag determine a loopback-only link.
2. Missing/malformed runtime config or an explicitly disabled Control UI provides an actionable disabled state, not a guessed working destination.
3. No token, password, session identifier or arbitrary external destination appears in the link. Native OpenClaw authentication remains native.
4. For SSH access, explain that the gateway port also needs forwarding; Canvas and native OpenClaw histories are separate.

## Requirements

- FR-001: Accessible Chat/Canvas/OpenClaw choice visible in Basic and Advanced modes, with explicit new-tab affordance.
- FR-002: Reuse existing runtime status polling, projecting only validated navigation fields; no new gateway probes or configuration writes.
- FR-003: Preserve iframe identity across navigation, mode changes and OpenClaw launch. No cross-interface draft/history transfer or auto-send.
- FR-004: Honor OpenClaw anti-framing headers; do not proxy/strip them or change gateway authentication, allowed origins or exposure.
- FR-005: Cover URL validation/credential exclusion, disabled states and DOM navigation/preservation with tests; inspect the browser layout.
- FR-006: Document the UI refinement and prepare 1.1.0, preserving immutable published 1.0.0. Include a source-linked content handoff addendum for the release.

## Success criteria

Configured native UI opens in a new tab through the header; Canvas remains the same DOM workspace. Relevant local tests/build and PR/main/tag CI pass before 1.1.0 publication. No live prompt or network change is sent during verification.

## Default standard Chat — user scope addition

- FR-007: Add a simple chronological user/assistant conversation as the default HUD landing view and default Chat header choice. Keep Overview available.
- FR-008: Send only the current Chat conversation through the existing authenticated `/api/hud/session` and scoped `/api/chat` path with a unique `hudThread`. Never use shared global history or fabricate a gateway answer.
- FR-009: Preserve Chat draft/history/in-flight turn when navigating to Canvas or other panels. New chat creates a fresh thread and clears the displayed conversation only after confirmation; disallow reset or concurrent send while waiting.
- FR-010: Visible loading, failure and empty-response states; restore unsent draft on failure, never automatically retry. Treat non-gateway fallback as service status rather than assistant evidence.
- FR-011: Escape message content; support multiline composition and Enter-to-send/Shift+Enter newline with IME-safe behavior. Link only validated task-bound assessment references to existing detail view.
- FR-012: Conversation is retained in memory while this HUD tab remains open; reload clears the local view, while gateway-side history follows runtime retention. Explain this plainly. Canvas persistence and native OpenClaw history remain independent.
- FR-013: No live prompts, paid calls or tool execution during automated/browser verification. Preview uses labeled synthetic conversation only.
