# Existing-interface capability matrix

Recovery source: unchanged NetClaw 1.8.0 / f943637. All implementation is under
`extensions/netclaw-vscode`; no base change has been demonstrated necessary for
these client functions. This is the retained boundary, not a parity claim with
all browser HUD or daemon functions.

| Area | Extension behavior | Existing authority / limit |
| --- | --- | --- |
| Connections | Host-context profile, loopback API, installation/harness binding | VS Code WSL/SSH owns transport; no remote/public HUD proxy |
| Chat | Owned session, prompt/context, history, model choices | OpenClaw synchronous reply; no owned status/stop route |
| Hermes | Owned conversation, nonce recovery, status, stop | Existing Hermes routes/companion; no model/effort override |
| Canvas | Local v1 import/export, branch context, owned lane requests | No server artifact manager; imported content confers no authority |
| Avatar | Bundled local characters plus owned Chat | No hosted video or voice path |
| RAG | Inventory, search/citations/staleness, reviewed upload | Existing RAG MCP via HUD; pending upload is not indexing completion |
| Environment | Masked presence, reviewed single-field replacement | Existing writer; presence verified, no secret reread or atomic CAS |
| Budget | Reviewed existing budget field, reread/check/result verification | Existing writer/policy; reread is not atomic CAS |
| Models/providers/harness | Runtime inventory, supported new-chat selection | No install/upgrade/harness replacement from profile selection |
| Services | Identity-checked existing CLI command preview/terminal staging | Human executes; no extension service manager or fabricated outcome |
| Risk, iN2N, eN2N | Native paged observations and existing peer chat | NCFED owns peers, roles, permissions, work, approvals and transport |
| GAIT | Existing federation audit projection and reviewed export | Not all GAIT history; broader inquiry through installed tools |
| Tokenomics | Existing usage/budget observations | Assistant-side model billing is excluded |
| DefenseClaw | Existing posture and masked environment settings | No new posture authority or replacement security configuration writer |
| OpenShell | Existing fixed-command inspection | No new sandbox lifecycle/policy controller |
| Network/Intent | Configured devices/topology and reviewed Intent submission/result | Existing baseline/change-policy/APPLY/verification; production one endpoint |
| Integrations/skills | Existing inventory | No installer/package lifecycle |
| Science/mobile/edge | Existing observations | No direct capture/push/enrollment mutation added |
| Memory/GCF/meetings | Explicit investigation context staged for Chat | Existing installed tools; no automatic listeners, joining or capture |
| Assistant MCP | Summary inspection, optional owned delegation, inert local drafts | Official SDK stdio; no approve/apply/raw HTTP/CLI/shell tools |

Uncertainty is explicit: older history does not certify completion; a lost
OpenClaw reply is never replayed. Native settings use the backend's present
validation and policy, not a new transaction/rollback/authorization layer.
Terminal assistants retain whatever independent OS access the user already gave
them; this adapter does not constrain that access.

Windows/WSL qualification of the existing OpenClaw installation is recorded in
[wsl-followup.md](wsl-followup.md), including real provider/context/RAG workflows,
interactive assistants, host/trust boundaries and installed lifecycle. All 22
observation panels rendered; that is not blanket operational health. The observed
Science snapshot was stale, mobile edge was unreachable, and OpenShell gateway
status was unavailable although sandbox listing returned. Device/Intent inventory
was inspected without configuration or external peer work. Hermes, WSL restart,
second-distribution/SSH and physical mobile qualification are not implied.
The final Mac implementation and package are recorded in [mac-final.md](mac-final.md).
Mac qualification is complete; the final RAG busy-state delta needs targeted WSL
confirmation before a future release. Publication is explicitly held by the owner.
