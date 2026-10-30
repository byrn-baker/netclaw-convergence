# Draft: guided Comms setup in the NetClaw installer

The VS Code installer now presents the documented OpenClaw and Hermes channel
inventories separately, with account preparation, private credentials, explicit
access settings and runtime-specific setup. Multiple channels retain independent
settings. Twilio and Zoom appear as Comms capabilities with explicit Focused/member
ownership, while the Border owns its conversation accounts.

This brings setup choices into one guided flow while preserving the differences
between a conversation channel, an outbound tool and a voice or meeting service.
Operators can see required accounts, dependencies and access settings before
creating a separate installation.

The implementation includes bounded native pairing, pinned dependency acquisition,
owned service and recovery checks, inert MCP discovery, and separate configuration,
authentication, transport and delivery evidence. The catalog records unsupported
baselines and incompatible integrations instead of silently dropping them.

Mac installer acceptance is complete for the documented isolated scope. The
reconciliation uses WSL return `04645395530a060b35404ec3a27bc516ae9ba076` with
the reviewed Mac Matrix test correction. Both actual empty-home engines verified
eleven effects, retained Slack/Discord settings through pause/resume, refused
changed ownership and stopped safely before empty-access service activation.
Fresh Twilio/Zoom acquisition and native registry discovery passed for both
runtimes. Controlled service fixtures passed owned-file, process-lifetime and
neighbor-preservation checks; provider connections and actual launchd activation
were not inferred from their synthetic manager responses.

Four final actual VS Code scenarios covered OpenClaw/Hermes and Focused/Risk
setups, including channel multiselection, cancelled setting edits, ownership
restrictions, reload, keyboard controls, themes and zoom. Both actual redacted
engine reports were opened as local documents. The Python suite passed 261 tests
with seven skips; the extension suite passed 143 with three skips. Opted-in
acquisition, owned-Hermes, MCP and certificate checks passed separately. Private
wrapper/preparation failures remain recorded alongside their successful postchecks.

Preservation checks found no changes in 8,012 selected primary files, 469
supplemental files, eleven logical database tables, twenty existing process
identities or one additionally selected live-service identity. The original
checkout remained unchanged. These are scoped observations with documented
baseline timing limits, not a claim about every installation or WSL identity.

WSL qualification has partially executed: Python finished with 261 passed and
seven skipped; extension tests finished with 137 passed, six failed and three
skipped. The six failures concern the unavailable isolated user service manager.
Actual WSL remote-editor acceptance remains open. Successful Mac checks cannot
replace those WSL results.

The evidence also distinguishes core Twilio/Zoom native registry discovery from
Twilio voice dependency acquisition and controlled ownership/routing contracts.
No voice call is required or performed for installer qualification. The same
boundary applies to provider authentication, account pairing, messages and meeting
capture: their readiness remains explicit without retesting domain operations.

A central lesson is that saved configuration, owned process state and delivery
answer different questions. The installer preserves those distinctions through
review, recovery and reports so that a successful local check cannot become an
unsupported claim about an external service.

This draft is **not a release or overall completion announcement**. Partial WSL
execution and remaining installer qualification gates are recorded in `coverage.json` and
`verification.md`. No operational capability retesting or live deployment is implied.
