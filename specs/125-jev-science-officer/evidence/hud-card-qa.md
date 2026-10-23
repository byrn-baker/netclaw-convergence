# Science Officer card visual QA

2026-09-27. Local Chromium via the pre-existing Playwright install; every outbound browser request aborted. The production `scienceOfficer` / `renderScienceOfficer` functions and `src/styles.css` rendered synthetic fixtures in a `.detail-panel` wrapper. This checks the card itself, not a connected production RISK.

Ready, stale and disabled snapshots were rendered at 1280×850 and 390×850. All six pages had no horizontal document overflow. Ready/stale each rendered one advisor card; disabled rendered none. Mobile ready and desktop stale screenshots were visually inspected: labels, amounts, timestamps and the authority caveat were legible without clipping.

The snapshot's configured state is explicitly not represented as live provider health. Stale snapshots are visibly marked. Shared unbound case accounting is shown without exposing the task identifier. Provider endpoint, key, question text, evidence and typed answers are excluded from the browser payload.

See `hud-card-qa.json` for measurements and `jev-<state>-<width>.png` for synthetic screenshots.
