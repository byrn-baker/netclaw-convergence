# Verification: default Chat and interface switch

## Local evidence — 2026-09-28

- HUD suite: **288 tests passed**, zero failures/skips. Includes default landing/three-way control, same Canvas iframe and Chat draft across navigation, scoped chronological messages, bootstrap ordering, duplicate-submit guard, pending-reset guard, new-thread reset after confirmation, fallback/HTTP/network/empty reply recovery, escaped content, validated Jev links and Enter/Shift+Enter/IME handling.
- Real HUD HTTP server plus local fake gateway: session cookie bootstrap, gateway authorization header, distinct task session keys, reuse within one conversation, no global history contamination, empty gateway response correctly classified `fromGateway=false`, and credential-free Control UI metadata with no-store caching. No actual gateway or paid model called by this fixture.
- Native UI projection tests: default/custom ports, base path, TLS, disabled/missing/malformed configuration, traversal/query/authority rejection and token exclusion.
- Production build: PASS, four entry points. Existing nonfatal >500kB chunk warning remains.
- Spec artifact check: PASS, 116 specs plus four historical exceptions. Release metadata check: PASS, 1.1.0. All six declaration reconciliation surfaces pass.
- Browser review: synthetic preview in Chrome at desktop width and 390×844. Default Chat, Chat→Canvas→Chat navigation, accessible selector, readable dark-theme messages and mobile composer verified. Document width 390 matched viewport 390 (no horizontal overflow). A first-pass contrast issue was fixed before acceptance; temporary viewport override reset.

- Release-helper tests: 6/6 pass. Generated reference refreshed: 159 CLI/source entries, 110 registrations, 296 source tool signatures, 41 routes and 312 documents. No integration-count change.

## Limits and corrections

The browser review uses synthetic records with sending/native launch disabled. DOM and real local HTTP fixtures verify behavior without live inference; no production device operation, paid prompt, real OpenClaw sign-in, native UI connection or cross-host/real-phone acceptance is claimed. Existing broader acceptance gaps remain documented in spec 127. Standard Chat deliberately retains local history only while the tab is open; runtime history follows separate retention. Its context window is 40 messages, matching the existing API.

Adding Chat initially displaced Science Officer from Basic navigation; corrected the visible-item allowance and reran regressions. Empty HTTP 200 gateway replies previously could be labeled fromGateway=true after fallback generation; now they are explicitly unconfirmed, with a regression on the real server fixture. No security/header/authentication workaround introduced.

## Release evidence

Publication follows PR, exact main and tag CI. GitHub release metadata, annotated tag and GAIT/daily memory record the actual result after this preparation snapshot. Do not infer publication from this file alone. v1.0.0 remains at 397a5390002acff196e06150c8f45a83c518a37a.
