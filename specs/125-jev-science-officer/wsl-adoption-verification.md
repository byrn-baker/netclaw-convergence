# WSL local Jev adoption — 2026-09-27

Installed into the existing Border on main at c4a5ff7 using the repository .env Jev key. The secret remains local. Backups and detailed evidence are in ~/.openclaw/jev-adoption-wsl (private); adopter recovery records are retained. No RISK recreation or member enrollment changes.

## Verified

- One MCP registration, six eligible Jev skills, targeted persona section and guide installed; repeated adoption produced no changes.
- Existing configuration is byte-equivalent as parsed after removing the Jev registration. Baseline file hashes and normalized skill-link targets match except the intended SOUL addition. Testbed and Prisma work preserved.
- 79 targeted offline tests passed. After the tool-description correction, the real stdio fixture passed again.
- Fresh gateway Border conversation authored a mixed Noul/Choice/Score batch over fictional evidence, called Jev once, retrieved the assessment and recorded its actual influence in GAIT. Assessment: 977675b7837d4414bf9dedd7a2d2aaee; model jev-1.13.0; 885 input / 104 output tokens; cost $0.00003717. Jev GAIT commit starts 52249e3d; Border decision commit a6620199.
- Initial commissioning conversation encountered locally rejected malformed requests, then eventually completed one successful synthetic assessment. Together the two successful provider requests cost $0.00006111. This was not a one-request acceptance overall. No private network evidence was supplied.
- Temporary $0.01 acceptance cap restored to $0.25 shared unscoped case, daily cap $5; existing spend retained. Assessment readback and ledger persisted across gateway restart.
- RISK HUD API exposes Jev as advisory-only and non-routable, matching ledger spending and latest assessment. Canvas HTTP 200; four members active. Gateway health passes; Slack enabled, running, connected, healthy, no error.

## Runtime correction and limitations

The Jev tool description lacked its nested question format and allowed purposes, causing Border to guess invalid fields. Added those details directly to server.py; fresh Border acceptance then passed without schema retries. This source correction is included with the member-result transport repair. See [runtime repair handoff](runtime-repair-handoff.md) for subsequent federation acceptance and limitations.

No Slack message was sent: readiness is supported by an actual gateway Border conversation plus Slack connection health, not a delivered Slack round trip. No fresh visual browser acceptance, live device test, or model-quality benchmark was performed. Existing out-of-root skill symlinks are preserved; OpenClaw continues to report those pre-existing skills as skipped. Jev's six regular skill directories are eligible. Work without trusted task binding shares unscoped spending; do not reset scope to evade limits. Private hosted evidence still needs exact-payload consent.

To try: start a fresh Slack thread with NetClaw and ask the Science Officer to review a hypothetical claim, requesting the assessment ID and how it affected Border's recommendation.
