# Return to the Mac development box

## Completed merge and operator adoption —2026-09-27

PR265 merged as `ee7b025607d052b3b4230a06da927e9393fcaced`; feature branch deleted locally/remotely; checkout returned to main before operator work. All144bounded task dispositions and103confirmed repairs are complete. Final PR-head native CI36327193441 at4fc65a4 also passed Flutter/analyze and both Runner/WatchApp builds; see evidence/wsl/macos-closeout-ci.json.751deferred paths remain unreviewed, not passed.

Private backup: `~/netclaw-backups/spec124-20260927T144807Z/` (`local-state.tar`, plus `root-owned-lab.tar` for two protected lab files). Both archives list successfully; backup-summary.json records the supplement's restore base. Keep both archives together. Recovery originals/journals remain beside migrated environments and in skill-deployment-backups; the previous GAIT generation is retained. Do not replace live state wholesale without stopping affected services and preserving subsequent edits.

Managed pinned pyATS runtime/HTTP bridge, GAIT generation, applicable TLS registration, strict existing SSH trust, loopback internal transport and file permissions passed preview/apply/repeat checks. Skills updated with recovery originals; all replaced originals match historical Git blobs.36Border links and its curated skill selection were preserved, updating only existing regular skills separately. Existing explicit lab mode was preserved; no production promotion or device change occurred.

Verification:666/666knowledge/workspace/testbed/Prisma preservation hashes unchanged, all28existing credential settings unchanged, gateway config structurally unchanged.11services running with0restart loops; authenticated gateway health and real no-tool model marker return passed; actual HUD/Canvas/API HTTP200; managed pyATS inventory5devices; federation enabled with4active members.11/12configured MCP discovery passed; PagerDuty lacks an API key. Twilio inbound Auth Token and Zoom OAuth panel credentials remain absent; those optional functions are not claimed working. No substitute credentials or external messages were created.

Current Windows interop is available and a fresh Windows Edge→WSL isolated HUD/Canvas HTTP/WebSocket/chat fixture check passes with no JS errors. No host interop write was needed. Historical missing-interop evidence remains a checkpoint, not current status. Audit containers from earlier acceptance are not present in the current Docker context; unrelated running containers were preserved.

Exact sanitized outcomes: [operator-adoption.json](evidence/wsl/operator-adoption.json). Raw configuration, device names, credentials and model output stay in the private backup/evidence directories. mac-handoff.md is the Mac return entry point. Mobile rebuild/install remains required to adopt the changed client; no reset or new App Store release was performed here.


Spec124 bounded closeout is complete; PR265 is merged and the actual WSL installation is migrated and verified as recorded above. Do not resume the former open-ended audit. Spec125 remains the HUD redesign; deferred review belongs in deferred-review.md.

## Completed platform evidence

| Host | Evidence and limits |
|---|---|
| macOS | Actual historical gateway/LaunchAgent health and configuration preservation; pyATS native CML12/12 and managed-runtime/recovery acceptance. Native macOS26/Xcode26.6 CI run36325037956 passed Flutter431, iOS Runner and WatchApp simulator builds. Updated103 native CI36326574760 also passed both builds at e008464;1709ddc production source is identical. No wiped-Mac installation or new physical phone/watch/background-runtime claim. |
| Linux | Disposable Debian bookworm Docker with real systemd user service: gateway install/start/health, full isolated pyATS+GAIT fresh/upgrade, managed adoption and restore/repeat, PEP668 refusal and literal private service environment. Four fixture hashes preserved. Shares WSL kernel; not bare-metal boot acceptance. |
| WSL2 | Isolated full fresh/upgrade pyATS+GAIT, foreground gateway health, preservation/recovery; CML12/12 read-only, NSM19 and Redfish15 Docker fixtures, FRR trusted/unknown/mismatched SSH checks. Historical Windows Edge HUD/Canvas chat and current WSL Chromium delayed Canvas session check are separate checkpoints. Actual operator upgrade occurs only after main and is recorded separately. |

Final local checks at1709ddc:24 contract families,434 Flutter tests/clean analyze,227 HUD tests/build, all six reconciliation surfaces and spec-artifact validation pass. Optional provider/device gaps and751 deferred baseline paths are not passes.

## Mobile rebuild required

Yes: the WSL/Linux continuation changed mobile Dart code and native iOS AppDelegate background-refresh setup (070,102,103), in addition to native CI/build preparation. The previously distributed app does not contain those changes. Rebuild on the Mac from merged main and install the rebuilt client to adopt them. Enrollment, credentials and conversations retain their formats; no reset or re-enrollment is required by these fixes. Physical phone/watch/background acceptance must be performed on that rebuilt client; simulator compilation alone does not establish it. A future distributed release needs its own build-number/signing/upload workflow; no new mobile release is authorized or published by this closeout.

## Safe Mac update

In the existing Mac checkout, inspect `git status --short` first. Preserve local edits, testbeds, credentials, knowledge, signing files and virtualenvs. Fetch origin and compare the recorded merge revision before switching to main; do not reset/clean or copy Linux virtualenvs to macOS. Once local work is safely retained, use `git switch main` and `git pull --ff-only origin main`. If local commits diverge, preserve them on a named branch/worktree and reconcile; do not force main over them.

Read SOUL.md, USER.md, TOOLS.md and the daily log; continue the GAIT trail on a Mac-specific session branch. Read handoff.md, verification.md, deferred-review.md and docs/AUDIT124-MIGRATIONS.md. Privately back up the Mac runtime/config/env/testbed/knowledge before applying any still-applicable platform-local migration. The WSL operator backup and runtime paths must not be imported over Mac state. Historical Mac pyATS originals lacking a matching digest journal remain manual recovery artifacts; do not manufacture a journal.

Verify gateway health and configured MCP discovery after adoption. Native development uses Flutter3.44.8 and the committed build workflow; signing/real-device acceptance needs the Mac's existing private credentials. CI uses a non-production Firebase fixture solely for compilation. Do not publish a new mobile build or claim App Store approval from this handoff; the historical last verified state was WAITING_FOR_REVIEW.

Resume prompt: “Read specs/124-flagship-audit/mac-handoff.md and handoff.md. Preserve this Mac's local work, verify the merged main checkpoint, and continue from the completed bounded spec124 handoff. Do not expand deferred audit work into spec125.”
