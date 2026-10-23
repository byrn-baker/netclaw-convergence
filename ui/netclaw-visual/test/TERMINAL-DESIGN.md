# Terminal design preview

With Vite running, open `/test/terminal-design.html` to inspect the actual
`TerminalLane` and enrichment components with explicitly synthetic data.
The fixture intercepts fetch requests and blocks WebSocket connections; it does
not connect to devices or providers, edit inventory, or save Canvas state.
Connection and management actions are not functional in this preview.

## Visual regression checklist

- Toggle Dark / Light and Wide / Compact / Canvas zoom.
- Click the highlighted `198.51.100.0/24` prefix. In a wide terminal the context
  fills the blank space after the longest visible text line. In a compact
  window it hides and the status bar asks you to widen the terminal. There is
  no floating fallback over CLI text. A pinned pane returns when space permits.
- Confirm the header and footer stay visible while the evidence scrolls.
- Verify the pane never extends beyond the visible terminal content.
- Upload a temporary image, choose Expand image, test Fit to window / Actual
  size, then Close or Escape. The underlying pane and attachment should remain.
- Open each desktop menu. Only one should remain open; Escape dismisses it.
  Choose Edit Testbed > Reload to verify action dismissal without a real request.
- Check source, VRF, freshness, reporting-router and ownership qualifications
  remain visible. The visual refresh must not change correlation semantics.

## Styling boundaries

`TerminalChrome.css` is scoped to `.nc-terminal` and does not change xterm font
metrics, selection, transforms or mouse-coordinate handling. Context styling is
scoped to `.terminal-enrichment-popover`. Dock geometry remains owned by
`enrichment-layout.js`, not CSS viewport breakpoints.

This is a frontend-only refresh. A browser refresh loads it; no API restart is
required for these visual changes. Pre-existing backend feature changes may
separately require an API restart.

Automated checks: `test:enrichment-layout`, `test:terminal-selection`,
`test:enrichment`, `test:topology-facts`, `test:observability`, `test:terminal`,
`node test/topology-evidence-labels.mjs`, and `npm run build`.
