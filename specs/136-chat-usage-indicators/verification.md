# Verification
- npm test: 306 passed, zero failures.
- npm run build: passed, existing bundle-size warning only.
- Context tests: exact session match, stale/missing count handling, unknown capacity and selected-model/provider mismatch.
- Privacy: binding lookup cannot read another cookie's task or create a task; provider projection excludes accountEmail, billing and raw errors.
- Cache: concurrent requests coalesced; separate TTLs; failed refresh retains a marked stale snapshot.
- Live LAN endpoint: new chat context unavailable; OpenAI quota reported 40% used / 60% remaining with 168h window and reset timestamp. No account identifiers returned.
- Chromium at 1280px and 390px: synthetic owned-context and quota snapshots render percentages, token count, quota bar and reset time. Detail panel within viewport, no page errors; mobile screenshot inspected.
- Real context schema was inspected from OpenClaw sessions CLI; no model call was made to create a new usage record. Long-running polling and alternate-provider quota behavior remain unverified.
- GUI API restarted while no active GUI request was present.
