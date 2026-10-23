# NetClaw Canvas optimization — first pass

Isolated working folder: `netclaw-canvas-optimization`.
Prepared PR branch: `131-canvas-terminal-workflows` (from the optimization work).
Starting point: `2d328b0c69b091673db6c547bc40585c950fd9a8`
(`netclaw-canvas-terminal-integration`).

This is the NetClaw browser integration, not the standalone Electron desktop
product. The original development checkout and published PR branch are unchanged.
No personal inventory, credentials or running service configuration was copied.

## What changed

- Extracted the SSH terminal from `App.jsx` into `TerminalLane.jsx`; shared theme,
  export helpers, API error handling and transcript limits have small modules.
- Load terminal, configuration-review and result windows on demand. Each has a
  positioned loading state and a local failure/retry boundary. A failed download
  in one window does not unmount another window's SSH session.
- Memoize structured-output preview parsing/validation for unchanged captures.
  Changing the source, format, device or Genie result invalidates the memo.
- Separated backend device profiles/credential resolution and host-key storage
  from `server.js`. Inventory and environment readers remain live, not cached.
  Consolidated the duplicated host-key write path.
- Added regression tests for lazy-window lifecycle and extracted backend services.
- Added a production bundle budget, including static shared imports, and fixed
  unit-test discovery so Windows does not silently report zero tests as success.

Authorization, host-key confirmation, legacy-KEX opt-in, production change
controls, collector scopes, Genie validation and stored Canvas schema are unchanged.

## Measurements

Production builds on the same host with Node 24.18.0, Vite 6.4.3 and the same
dependency lockfile. Sizes are decimal KB. Gzip is measured per delivered file.

| Measurement | Before | After |
| --- | ---: | ---: |
| Canvas entry JavaScript | 728.77 KB | 195.14 KB |
| Initial Canvas JS, including static dependencies | 872.41 KB | 339.92 KB |
| Initial Canvas JS, gzip | 250.47 KB | 107.73 KB |
| `App.jsx` lines | 5,759 | 3,303 |
| `server.js` lines | 3,209 | 2,882 |

Initial JS is approximately **61% smaller** (57% gzip). This is deferred loading,
not deletion of terminal features. Restoring a session containing a terminal
immediately requests its terminal chunk. Total downloaded code after opening
every feature is approximately unchanged and can be slightly larger due to
chunk-loading/error handling. No CPU, memory or end-to-end speedup is claimed.

This is not a claim that the implementation is now minimal. `TerminalLane.jsx`
still has 2,330 lines, and its roughly 511 KB chunk retains a Vite size warning.
Further useful work includes splitting device/credential dialogs and intent
state management, then profiling real transcript rendering and collection load.
Do not remove safety checks or change collector polling merely to reduce LOC.

## Verification

Run from `ui/netclaw-visual`:

```sh
npm ci --ignore-scripts
npm run test:canvas
npm run test:bundle
npm test
```

- 27/27 Canvas suites passed using mocks/synthetic loopback devices.
- Production build and initial-JS budget (<400,000 bytes) passed.
- Seven saved-session regression tests passed.
- Full upstream test discovery: 270 tests, 255 passed, 15 failed. These are the
  same known Windows failures documented for the starting branch (POSIX file
  permissions, symlink privileges, dashboard URL/path handling). They remain
  failures; Linux validation is still required before merge.
- Browser smoke check of the synthetic terminal preview: terminal rendered,
  route context opened, and the Genie structured-output view opened. No live
  SSH, inference, pyATS execution or external-provider calls were made.

The scripts do not restart the user's existing frontend/API. This optimization
pass is included in the draft [spec131 contribution](specs/131-canvas-terminal-workflows/spec.md)
on top of the latest fetched upstream HUD base (`40425bb`).
