# VS Code 1.0.1 input/address hotfix — acceptance and publishing handoff

Branch: `hotfix/vscode-1.0.1-input-focus`, based on main `2faa215` (PR 296).
Owner requested a new hotfix, not a spec or website update. The reported affected
environment is **Windows VS Code / WSL, NetClaw 1.0.0**. The owner offered to move
the remaining work to that environment. The Windows/WSL investigation below supersedes the initial Mac-only checkpoint.
Publish only the unchanged artifact identified in the final handoff after acceptance.

## Findings and changes

The exact Marketplace 1.0.0 VSIX reproducibly selects `connections.defaults`
instead of the first actual endpoint. With a representative synthetic pyATS
testbed it returns connection `defaults`, address `""`, and the `192.0.2.10`
example placeholder. The owner's local testbed has the same defaults-first
structure (only structure was inspected; private addresses were not exported).

The extension now filters this reserved mapping from HUD projections, so the
fix also works with an already-running HUD. The HUD itself excludes defaults
from cards/CSV and rejects guided endpoint changes to it. The extension also
rejects that connection name before calling an older HUD. Shared defaults,
credentials, other connections, and advanced endpoint fields are preserved.

Previously every Testbed input event sent an `invalidate` message and updated
VS Code webview state. Typing now changes only local draft state. Preview and
Save carry a draft revision, the host rejects missing/mismatched revisions, and
the webview rejects delayed previews. Changing or cancelling a draft invalidates
the old review without host traffic. No input values are persisted in webview
state. The existing HUD write/review API remains unchanged.

The Mac reproduction initially showed a dropped character, but event tracing
identified delayed VS Code forwarding of the test's Select All shortcut. Letting
that native command settle removed the test artifact. The old 1.0.0 Mac build
then passed continuous typing and failed specifically on the defaults/IP check.
**The Windows/WSL one-character focus failure is still unverified on Mac.**

## Verification on Mac

- Typecheck and build passed. 64 extension tests passed; one optional cached
  RAG test was skipped. Unit/HTTP tests cover no per-keystroke
  messages/state, delayed review rejection, host-side stale-save refusal, and
  compatibility with older HUD projections.
- All 372 HUD unit tests and 10 document/configuration tests passed, including
  reserved-default protection, CSV projection, preservation, revision guards
  and credential handling. Extension dependency audit found no vulnerabilities.
- Native source input suite passed on VS Code 1.108.0/macOS arm64: existing and
  new fields, search, IPv4/IPv6/host/ENV references, native reviewed save and file
  readback, preserving shared defaults/credentials/console/SSH options, and YAML.
- Native source experience suite passed 18 checks, 149 layout cases and 43
  screenshots. MCP secret/URL and DefenseClaw/OpenShell rule fields now use real
  page keyboard events with focus/value checks after every character.
- The exact installed 1.0.1 candidate passed six focused input workflows and
  all 18 experience checks / 149 layout cases / 43 screenshots on VS Code
  1.108.0, macOS arm64. This includes Backspace, Unicode text insertion,
  editing after preview, stale-review disappearance, and a fresh reviewed save.
  All 32 installed extension payload files match the VSIX (allowing VS Code's
  own package metadata). All runtime writes use isolated fixtures.

## Original Mac candidate artifact

- Source: `17e79e4395e320e7d39a79d54263c7007baa48cf`.
- File: `netclaw-1.0.1.vsix`, 4,213,410 bytes.
- SHA-256: `b26cab8083558fb412e4772b94058463887bc22bf973db148d375605a92fc8b3`.
- Mac evidence/artifact cache: `~/.cache/netclaw-101-hotfix-20261012`.
- Draft PR: <https://github.com/automateyournetwork/netclaw/pull/297>.
- Extension CI passed on that source. Broader HUD CI was still running at this
  checkpoint. CI rebuilds have their own digest and are not the Mac-tested bytes.
  If using a rebuilt VSIX on WSL, verify and record that exact candidate there.
- No 1.0.1 Marketplace upload or merge was performed.

`test/keyboard.cjs` focuses once, then sends keys through `page.keyboard` and
checks focus and value after every character. It does not refocus the locator
for each key. Native Select All is given time to finish before typing.

## Original Windows/WSL acceptance plan

1. Fetch and check out `origin/hotfix/vscode-1.0.1-input-focus`. Follow startup
   and GAIT instructions; keep owner Testbed, `.env`, and security configs safe.
2. Before updating the affected editor, inspect **Developer: Show Running
   Extensions** and the NetClaw extension's installed location/version in that
   WSL window. Preserve the failing 1.0.0 artifact and compare its payload with
   the published build if possible. Check both local Windows and WSL extension
   installations; a manifest/version label alone does not establish which
   extension host is active. Do not assume the user failed to reload.
3. Reproduce using actual keyboard input in the affected Windows renderer. Trace
   input, focus/blur, selection changes, `disabled` changes and host messages as
   needed. Determine whether the candidate's removal of per-keystroke IPC fixes
   this failure; investigate further if it does not.
4. Install the exact 1.0.1 VSIX into the WSL extension host and reload that
   Windows VS Code window. Verify **1.0.1 is actually running there**. Use an
   isolated testbed/HUD for saves, or a separately copied owner inventory with
   credentials kept private. Do not write synthetic devices into live inventory.
5. Exercise Edit and Add with uninterrupted typing, held keys, Backspace/Delete,
   selection replacement, paste, Tab/Shift+Tab and multi-line YAML. Verify the
   displayed address matches the selected named endpoint, switch SSH/console,
   preview, edit again (old review must disappear), review/save, reopen and read
   back the stored file. Preserve defaults, credentials and unused endpoints.
6. Check MCP replacement fields and both security forms with continuous typing,
   using isolated native fixtures for any writes. Check slow responses, tab
   switches, and disconnect/reconnect. Record exact Windows VS Code version,
   WSL distribution, active extension host/version, HUD source and VSIX SHA-256.
7. Run the automated suites below. Linux VS Code under WSLg/Xvfb is useful
   additional evidence, but **does not replace Windows-renderer + WSL-host
   acceptance**. `scripts/editor.mjs` currently launches a local editor/fixture;
   it is not a Windows/WSL remote-host automation harness.
8. Once the affected environment passes, update this report and the candidate
   status in README/CHANGELOG/package qualification text, commit changes,
   run PR checks, merge, and publish the **unchanged tested artifact** as 1.0.1.
   The owner's hotfix publication authorization is already present. Verify
   Marketplace validation, public version, and downloaded SHA-256, not only
   vsce's upload receipt. No website/blog work is requested.

## Automated commands

Use supported Node 24.19 or 26.1+, install both locked dependency trees, then:

```sh
cd extensions/netclaw-vscode
npm ci
npm --prefix ../../ui/netclaw-visual ci
npm run check
npm run build
npm test
npm --prefix ../../ui/netclaw-visual run test:experience
```

For a local native editor, with an isolated fixture and synthetic data:

```sh
VSCODE_EXECUTABLE=/path/to/editor \
NETCLAW_TEST_VSIX=/path/to/netclaw-1.0.1.vsix \
NETCLAW_TEST_NATIVE_REVIEW=1 \
NETCLAW_TEST_SUITE=inputs \
NETCLAW_TEST_PLAYWRIGHT=/path/to/playwright \
node scripts/editor.mjs
```

Repeat with `NETCLAW_TEST_SUITE=experience`. On Linux/Windows, installed VSIX
tests also require `VSCODE_CLI` pointing to the matching editor's CLI. Native
review tests need a real display or a correctly configured virtual display.
For source development omit `NETCLAW_TEST_VSIX`; build first. Commit reviewed
source before `npm run package`. `out/package.json` records the source commit,
artifact size and SHA-256. Installing/building a new candidate is not publishing.


## Windows/WSL investigation — 2026-10-12

The affected Windows renderer is VS Code **1.141.0**, Electron 43.7.7 /
Chromium 150, with a Linux extension host in WSL2 (distribution registration
`Ubuntu-22.04`, actual guest **Ubuntu 26.04 LTS**). Do not infer the guest OS
version from the distribution registration name.

All 32 files of the installed 1.0.0 extension matched the downloaded Marketplace
1.0.0 package (allowing VS Code's installation metadata). Its SHA-256 is
`8200e567f3094471828cfbb3e06b450bd8d5abe36568d67f623c2efdb3c5f0f3`.
However, a read-only inspection of the **already-running affected extension
host's loaded module cache** found `netclaw.netclaw-0.1.1/dist/extension.cjs`.
The host log independently shows activation following 0.1.1 installation and no
new activation following the 1.0.0 installation. This is evidence of the code
actually executing; a manifest/version label or installed directory was
insufficient. The temporary loopback inspector was closed after inspection.

The exact symptom was reproduced in a separate Windows-renderer/WSL-host window
with an unchanged 0.1.1 artifact. With the alias field focused once, page keyboard
input `XYZ` changed `Lab router` to **`Lab routerX`**. The event trace recorded:

1. `X` keydown and input on `device-alias`.
2. Approximately 9 ms later, host `busy: true`, input disabling and `focusout`.
3. Host `busy: false` re-enabled the field without restoring focus.
4. `Y` and `Z` keydowns targeted the page, leaving the field unchanged.

The cause is the earlier host's per-input `invalidate` dispatch entering its
busy-control path. A fresh, exact published **1.0.0** host passed all six original
input workflows with the current isolated HUD; this investigation does **not**
claim a reproduced 1.0.0 focus defect. That HUD already filters shared defaults,
so this comparison does not independently reproduce the older-HUD address bug.
The 1.0.1 local draft/revision implementation eliminates the per-keystroke host
path entirely and retains the extension-side address correction for older HUDs.

The first installed 1.0.1 candidate passed ten expanded Windows/WSL workflows:
continuous Edit/Add typing, held/repeated keydown, Delete/Backspace, real clipboard
replacement and Unicode, Tab/Shift+Tab, editor tab switching, delayed preview
recovery, review invalidation, endpoint variants and reviewed save/file readback,
multiline YAML, and disconnect/reconnect. The delay test holds delivery of a real
fixture HUD preview response for 600 ms; it does not change the packaged handlers.
Clipboard contents are restored without logging them. Saves use synthetic private
fixtures, never the owner's active inventory.

The broader experience test's viewport check now allows one pixel of scroll
rounding: the Windows form was fully visible and focused, but its border measured
`top=-0.390625`. Initial harness attempts also exposed reuse of a mutated fixture
between suites; final acceptance uses a fresh fixture for each suite. These were
harness corrections, not additional product behavior changes.

The extension unit suite passed 64 tests (one optional cached RAG skip). The HUD
suite initially passed 371/372 with a 25 ms avatar-render timing assertion failure;
the isolated avatar check and a complete standard-suite rerun passed, **372/372**.
All ten document/configuration tests passed. Typecheck, build and dependency audit
passed. No new device, provider or live security-policy operation was performed.

Raw local evidence: `~/.cache/netclaw-101-wsl-20261012/` (affected-host module
inspection, preserved old artifacts, keyboard event trace, native reports and
screenshots). MemPalace was unavailable (missing module); GAIT records the session.

## Publication ownership

The owner requested the **Mac publishing handoff** after WSL publisher verification
failed with `TF400813` and no publisher credentials were configured here. Acceptance
and PR completion remain authorized. No Marketplace upload is performed from WSL.
The handoff includes the unchanged tested VSIX, `SHA256SUMS`, source provenance,
and exact-artifact publishing/verification commands. Do not rebuild it on the Mac.


## Windows/WSL acceptance result

The installed 1.0.1 candidate passed **10 input workflows**, **18 experience
checks**, **149 layout cases** and **43 screenshots** in the real Windows renderer
with a WSL extension host. The experience run includes continuous MCP secret/URL
and DefenseClaw/OpenShell rule typing, reviewed fixture writes, theme/width/zoom
and keyboard checks, and clearing sensitive drafts on disconnect. All installed
payload files are compared with the selected VSIX before each suite.

The final distribution artifact is reinstalled and subjected to the same input
and experience suites after release-text packaging. Its authoritative source,
byte count and SHA-256 accompany the draft GitHub handoff release
`vscode-v1.0.1-rc.1` as `package.json`, `acceptance.json` and `SHA256SUMS`.
This avoids a self-referential digest in the packaged documentation. The raw
reports remain in the private evidence cache; the handoff report contains only
synthetic acceptance and package metadata. Previous Mac acceptance covered the
same product code in the earlier package described above; no new Mac run or
native Windows extension-host support is claimed by the WSL qualification.
