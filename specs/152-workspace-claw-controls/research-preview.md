# Isolated VS Code preview and acceptance research

Inspected 2026-10-15. Read-only discovery; no editor launched, package created,
runtime changed or provider/device called during this research.

## Existing harness to reuse

- `extensions/netclaw-vscode/scripts/preview.mjs`: persistent native source preview.
  It creates temporary user-data/extensions directories, a copied source HUD,
  synthetic gateway/config/credentials, an observer extension and a loopback CDP
  port. The observer activates `NetClaw.netclaw`, saves an isolated connection,
  connects and opens Overview. Closing its window closes its fixture. No VSIX is
  built or installed. Existing Spec151 title/metadata names need Spec152 updates.
- `extensions/netclaw-vscode/scripts/editor.mjs`: source desktop acceptance runner.
  Existing suites are default, `experience`, `inputs` and `compatibility`.
  `NETCLAW_TEST_NATIVE_REVIEW=1` selects a normal isolated window with a separate
  observer. This matters: VS Code refuses native review dialogs when launched with
  `extensionTestsPath`; a test-only mock would miss the actual confirmation path.
- `test/real-hud-fixture.mjs`: temporary repository-like root, private runtime home,
  temporary ports, source HUD process, synthetic OpenClaw executable and gateway.
  Environment is explicitly constructed with temporary HOME/runtime/config paths;
  it does not load owner credentials. Current fixture is **OpenClaw only**. Its
  gateway is an HTTP server in the fixture parent's process and its fake OpenClaw
  executable only handles model/session/history reads. It currently has no six-file
  workspace or restartable full-installation service fixture.
- `test/editor-experience.cjs`: actual nested webviews over Playwright CDP, native
  dialogs, screenshot/report generation, light/dark/high-contrast, narrow widths,
  200% zoom and focus checks. `test/editor-inputs.cjs` and `test/keyboard.cjs` cover
  the prior input-loss regression using page keyboard events.

## Observed local prerequisites

- Current `node --version`: `v24.19.0`, supported by the HUD.
- Both extension and HUD `node_modules` exist.
- Cached VS Code 1.102.0 and 1.141.0 exist below
  `/Users/john.capobianco/netclaw-spec150-review/.vscode-test/`.
- Existing Spec151 source-preview metadata names the previously used executable:
  `/Users/john.capobianco/netclaw-spec150-review/.vscode-test/vscode-darwin-arm64-1.102.0/Visual Studio Code.app/Contents/MacOS/Electron`.
- `/Applications/Visual Studio Code.app` is version 1.108.0. Prefer the isolated
  cached executables for repeatable acceptance; these paths describe availability,
  not an assertion that any old preview process remains alive.
- A usable existing Playwright Core package is at
  `/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core`
  (1.61.1). It exports Chromium CDP control and does not need a separate browser
  download for attaching to VS Code. Another existing copy is at
  `/Users/john.capobianco/NetWorld/NetWorlds-instructions/web/node_modules/playwright-core`
  (1.56.1). Neither is an extension dependency; select an explicit module path.

## Reusable commands

Run from `extensions/netclaw-vscode` after implementing the feature and updating
the focused fixtures/suite. These commands are documentation, not executed tests.

```sh
npm run check
npm run build
npm test
```

Native existing experience regression:

```sh
VSCODE_EXECUTABLE='/Users/john.capobianco/netclaw-spec150-review/.vscode-test/vscode-darwin-arm64-1.102.0/Visual Studio Code.app/Contents/MacOS/Electron' \
NETCLAW_TEST_PLAYWRIGHT='/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core' \
NETCLAW_TEST_NATIVE_REVIEW=1 \
NETCLAW_TEST_SUITE=experience \
npm run test:editor
```

Repeat with `NETCLAW_TEST_SUITE=inputs` for native continuous-input regression and
with the 1.141.0 cached editor for compatibility coverage. The default editor suite
exercises Chat/Canvas/Avatar/RAG/assistant behavior. Keep `NETCLAW_TEST_LIVE_HUD_URL`,
`NETCLAW_TEST_LIVE_ID` and `NETCLAW_TEST_VSIX` unset for this source-only task.

Persistent source preview:

```sh
VSCODE_EXECUTABLE='/Users/john.capobianco/netclaw-spec150-review/.vscode-test/vscode-darwin-arm64-1.102.0/Visual Studio Code.app/Contents/MacOS/Electron' \
npm run preview:local
```

Today this opens the existing Spec151 OpenClaw fixture, so it is **not yet a
Spec152 acceptance command**. Extend the launcher first to seed and bind both
runtime fixtures, open the new top-panel controls and write uniquely named
Spec152 metadata. Preserve temporary profiles, explicit source development paths,
synthetic labels, owner-only metadata and cleanup of only owned fixture processes.
Do not reuse `scripts/lifecycle.mjs`: that script tests VSIX installation/upgrade,
not the claw service lifecycle, and is outside the requested local preview phase.

## Required Spec152 fixture and acceptance additions

1. Provide distinct OpenClaw and Hermes installations with actual managed file
   locations and six synthetic documents. Give them different identities and
   contents, and keep a neighboring installation running during lifecycle tests.
   Do not relabel the current OpenClaw fixture as Hermes. The existing
   `test/hermes.test.mjs` tests Hermes chat bindings through an Express stub; it
   is not a full native editor/workspace/service qualification fixture.
2. Use the real extension and source host-management adapters to operate fixture
   services with observable ownership and process identity. A HUD response alone
   cannot prove full stop/start. Stop must actually remove the fixture HUD/engine/
   configured federation services, and the native extension-host Start path must
   work with HUD down. Record process identities before/after and neighbor survival.
3. Native file flows: read, edit and upload each of six catalog entries; overwrite
   and create-missing; byte-for-byte readback/unselected-file preservation; explicit
   empty file; no delete or path escape; private recovery; stale file/destination/
   selected-installation rejection; cancelled dialog; denied writes and unknown
   outcomes; retained drafts and delayed response fencing.
4. Native combined controls: Save alone starts zero lifecycle operations; Save and
   Restart starts exactly one after verified persistence; failed/cancelled/conflict/
   unknown save starts zero. Test lifecycle partial/fault/timeout, extension reload,
   changed service identity/set and surviving local operation evidence.
5. Reuse `typeAndCheck`: focus a field once then send subsequent keys through
   `page.keyboard`. Repeated `locator.fill`/`locator.press` refocuses an element and
   previously hid the one-character input defect. Exercise Unicode, held keys,
   undo/redo, selection, paste, Tab, theme change, editor-tab switch and refresh
   during a dirty draft.
6. Check source Markdown has no automatic external fetch or executable rendering.
   Screenshots/evidence must contain synthetic files only. Save routine logs with
   revisions/operation IDs, not raw workspace contents.
7. Run existing extension tests and native experience/inputs/default suites after
   the focused suite passes. Preserve testbed defaults, credentials, multiple
   connections, delayed-preview disabled state, existing security dialogs, MCP
   setup and existing assistant tool boundaries.
8. Leave the implemented source preview open with the two synthetic connections,
   visible new controls and exact profile/fixture/ready metadata. Capture an actual
   rendered screenshot and inspected readiness, then present it for owner review.
   Mark Mac evidence as Mac evidence; Linux/WSL/Remote SSH need their own runs
   before claiming host qualification.

## Source evidence

`specs/151-extension-experience/quickstart.md` and `verification.md` document the
prior source-preview boundary and 149-row native experience matrix. Existing
`test/editor-hotfix.cjs` covers long testbed lists, visible/focused edit/review,
cancel/save/recovery and connection preservation. `test/editor-inputs.cjs` adds
the real keyboard regression; include that behavior in new Markdown editing.
