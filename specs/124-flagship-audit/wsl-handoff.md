# WSL/Linux acceptance and operator handoff

## Completed merge and operator adoption —2026-09-27

PR265 merged as `ee7b025607d052b3b4230a06da927e9393fcaced`; feature branch deleted locally/remotely; checkout returned to main before operator work. All144bounded task dispositions and103confirmed repairs are complete.751deferred paths remain unreviewed, not passed.

Private backup: `~/netclaw-backups/spec124-20260927T144807Z/` (`local-state.tar`, plus `root-owned-lab.tar` for two protected lab files). Both archives list successfully; backup-summary.json records the supplement's restore base. Keep both archives together. Recovery originals/journals remain beside migrated environments and in skill-deployment-backups; the previous GAIT generation is retained. Do not replace live state wholesale without stopping affected services and preserving subsequent edits.

Managed pinned pyATS runtime/HTTP bridge, GAIT generation, applicable TLS registration, strict existing SSH trust, loopback internal transport and file permissions passed preview/apply/repeat checks. Skills updated with recovery originals; all replaced originals match historical Git blobs.36Border links and its curated skill selection were preserved, updating only existing regular skills separately. Existing explicit lab mode was preserved; no production promotion or device change occurred.

Verification:666/666knowledge/workspace/testbed/Prisma preservation hashes unchanged, all28existing credential settings unchanged, gateway config structurally unchanged.11services running with0restart loops; authenticated gateway health and real no-tool model marker return passed; actual HUD/Canvas/API HTTP200; managed pyATS inventory5devices; federation enabled with4active members.11/12configured MCP discovery passed; PagerDuty lacks an API key. Twilio inbound Auth Token and Zoom OAuth panel credentials remain absent; those optional functions are not claimed working. No substitute credentials or external messages were created.

Current Windows interop is available and a fresh Windows Edge→WSL isolated HUD/Canvas HTTP/WebSocket/chat fixture check passes with no JS errors. No host interop write was needed. Historical missing-interop evidence remains a checkpoint, not current status. Audit containers from earlier acceptance are not present in the current Docker context; unrelated running containers were preserved.

Exact sanitized outcomes: [operator-adoption.json](evidence/wsl/operator-adoption.json). Raw configuration, device names, credentials and model output stay in the private backup/evidence directories. mac-handoff.md is the Mac return entry point. Mobile rebuild/install remains required to adopt the changed client; no reset or new App Store release was performed here.


The user authorized bounded closeout on2026-09-27. Do not resume broad audit expansion. See handoff.md for current merge/operator status and mac-handoff.md for returning to the Mac.

## Acceptance completed

Docker Debian bookworm with real systemd proved gateway user-service installation/start/health, full isolated fresh/upgrade pyATS+GAIT, managed-source adoption, private literal EnvironmentFile, PEP668 refusal and repeat/restore behavior. Four fixture hashes for configuration/persona/testbed/knowledge remained unchanged. The container shares WSL's kernel: this is native Linux userspace/service-manager acceptance, not bare-metal boot proof.

Isolated WSL full fresh/upgrade pyATS+GAIT passed with four preserved hashes and custom skill retained. A separately started foreground gateway on19338 passed health and was stopped. Installer default discovery could see the operator18789 gateway, so that discovery is not claimed as isolated service proof; Docker real systemd and the dedicated foreground check supply the distinct evidence.

Historical Windows Edge→WSL HUD/Canvas HTTP/WebSocket synthetic chat passed at its recorded checkpoint. Current Canvas100 was checked in actual WSL Chromium with delayed replies/session-change refusal. WSLInterop was absent at the earlier checkpoint; it is available in the current session and fresh Windows Edge acceptance passed after main. A separate real-provider request passed without tools, CML12/12read-only checks passed, FRR trusted/unknown/mismatched key cases passed, NSM19 and Redfish15 Docker fixtures passed. Raw credentials/topology/provider results remain private.

Final local checkpoint1709ddc:24contract families PASS with0FAIL/ERROR/dependency blockers,434Flutter/analyze,227HUD/build/audit0, six reconciliation surfaces and spec-artifact checks pass. Optional credentialed/Docker capability notices are not failures or live passes. Updated mobile native CI is tracked in handoff.md.

## Actual operator phase

Completed after PR265 merge and return to main: private backup, applicable migrations from docs/AUDIT124-MIGRATIONS.md and contracts/audit-and-migration.md, retained recovery generations/journals, service restart and health/discovery/preservation verification. Preserve testbed/testbed.yaml and untracked Prisma work. No bulk knowledge/cache/certificate purge is authorized or required.

Private evidence and owned acceptance fixtures: ~/.openclaw/audit124-wsl; containers netclaw-audit124-linux, netclaw-audit124-frr and netclaw-audit124-redfish. Preserve unrelated services. Exact operator backup/migration outcomes are recorded above.

## Follow-up limits

751baseline paths are deferred, not passed. No real phone/watch/background-refresh, live Zoom Layers/Twilio/vendor/ServiceNow, RAG quality, wiped-Mac or bare-metal Linux acceptance claim. See deferred-review.md. Spec125 remains the HUD redesign.
