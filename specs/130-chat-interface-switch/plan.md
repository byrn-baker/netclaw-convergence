# Implementation Plan

**Spec**: [spec.md](spec.md) | **Branch**: `130-chat-interface-switch`

## Approach

Add a pure allowlisted Control UI location projection and URL builder shared by server/client. Server adds the projection to existing `/api/hud/runtime` response. Client validates again and renders a compact header group: Chat button, Canvas button and native OpenClaw anchor with target blank, noopener/noreferrer and no-referrer policy. Missing/disabled/stale source becomes a disabled control with an explanation. Preview never launches a real gateway. Native launch leaves the current view and Canvas untouched.

## Constitution check

Numbered accepted spec precedes implementation. No provider, authentication, iframe policy, device or production configuration changes. GAIT and daily memory track the session. Inventory unchanged. Default linear chat is a new capability and requires minor release 1.1.0, with known native authentication and remote port-forward requirements documented. Preserve 1.0.0.

## Verification

Unit-test default/custom port, base path, TLS, disabled/malformed data and secret exclusion. DOM-test anchor/new-tab attributes, same Canvas iframe and pending context across navigation, Basic/Advanced and launch. Test missing/failed runtime and synthetic preview. Full HUD tests/build; spec/declaration checks; real browser inspection with synthetic/private-data-safe fixtures. CI before merge and publication.

## Rollback

Revert the UI follow-up through a new commit/patch if needed; no runtime migration or storage change. Never move a published release tag.

## Standard Chat design

Permanently mounted React component hidden on other views, in-memory transcript/draft and per-mount random thread identity. Reuse session bootstrap and scoped API contract, sending chronological role/content context; no global history read or transport changes. A synchronous pending ref prevents duplicate submissions; reset is disabled during a request. Failed transport/fallback/empty answers retain the draft and report uncertainty without retry. Only successful gateway responses become assistant messages. Native OpenClaw gets no transcript/draft/token transfer. Unit/DOM tests use fake gateway responses; browser preview is synthetic.
