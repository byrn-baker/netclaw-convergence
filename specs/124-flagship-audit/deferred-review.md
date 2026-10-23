# Deferred review and acceptance backlog

The user explicitly bounded spec124 on 2026-09-27: finish confirmed fixes, triage only release blockers, and defer remaining review without claiming it passed. This backlog is separate from spec125, which remains the HUD redesign. A disposition is not source certification.

## Release-blocker triage

The existing finding register, acceptance failures and known limitations were triaged against security, data-loss and installation/runtime failures preventing safe use. Confirmed findings001–103 have repairs; native verification of103 passed in CI36326574760. No additional confirmed release blocker was established by this bounded triage. Unreviewed code may still contain defects: this is not an exhaustive audit or absence-of-vulnerabilities claim.

## Unreviewed baseline paths

The following751 paths retain explicit deferred-review status in coverage.json. The exact machine-readable path list, ownership and subsystem remain there. Targeted review (461 paths) and measured execution (271 paths) also do not certify whole files.

| Subsystem | Deferred paths |
|---|---:|
| .specify | 12 |
| RALPH INPUTS | 3 |
| benchmarks | 2 |
| captures | 14 |
| docs | 26 |
| examples | 7 |
| lab | 6 |
| mcp-servers/README.md | 1 |
| mcp-servers/analysis-mcp | 2 |
| mcp-servers/atlassian-mcp | 1 |
| mcp-servers/auvik-mcp | 10 |
| mcp-servers/azure-network-mcp | 17 |
| mcp-servers/batfish-mcp | 4 |
| mcp-servers/bgp-intel-mcp | 10 |
| mcp-servers/catc-mcp | 1 |
| mcp-servers/chrome-devtools-mcp | 1 |
| mcp-servers/cisco-psirt-mcp | 8 |
| mcp-servers/claroty-mcp | 14 |
| mcp-servers/document-mcp | 9 |
| mcp-servers/eve-ng-mcp-server | 12 |
| mcp-servers/fortinet-mcp | 5 |
| mcp-servers/gitlab-mcp | 1 |
| mcp-servers/gnmi-mcp | 8 |
| mcp-servers/gns3-mcp-server | 3 |
| mcp-servers/halo-mcp | 12 |
| mcp-servers/image-style-mcp | 3 |
| mcp-servers/ipfix-mcp | 4 |
| mcp-servers/jenkins-mcp | 1 |
| mcp-servers/multivendor-cli-mcp | 11 |
| mcp-servers/n2n-mcp | 3 |
| mcp-servers/nautobot-golden-config-mcp | 2 |
| mcp-servers/nautobot-mcp-v2 | 26 |
| mcp-servers/nautobot-routing-mcp | 2 |
| mcp-servers/nsm-mcp | 5 |
| mcp-servers/ollama-mcp | 10 |
| mcp-servers/packet-buddy-mcp | 1 |
| mcp-servers/protocol-mcp | 46 |
| mcp-servers/redfish-mcp | 2 |
| mcp-servers/snmptrap-mcp | 5 |
| mcp-servers/suzieq-mcp | 3 |
| mcp-servers/syslog-mcp | 4 |
| mcp-servers/topology-diagram-mcp | 3 |
| mcp-servers/tts-mcp | 1 |
| mcp-servers/twilio-voice-mcp | 7 |
| mcp-servers/twitter-mcp | 7 |
| mcp-servers/worldlabs-marble-mcp | 3 |
| mcp-servers/zoom-rtms-mcp | 9 |
| mobile | 126 |
| root | 12 |
| scripts | 55 |
| testbed | 2 |
| tests | 13 |
| workspace | 196 |

Future review should prioritize authorization/identity and persistence boundaries in those paths, then installer/transport error behavior, mobile lifecycle and remaining tool-schema/skill semantics. Historical references, generated files and asset inventories are inventory dispositions, not semantic passes.

## Acceptance and lower-priority follow-up

- Real iPhone/watch background refresh, push, biometric and enrollment flows after103: simulator builds and Flutter tests do not establish physical-device behavior.
- Zoom Layers entitlement/live meeting and Twilio live calls; optional overlay remains unavailable in the shipped panel. SDK fixture success is not live acceptance.
- Credentialed vendor/cluster integrations and exact-record ServiceNow lookup remain unverified. Contracts exercise defined fixtures only.
- RAG model retrieval quality and abrupt-process cross-store replication recovery require a dedicated corpus/recovery campaign; retained rollback inspection is documented in AUDIT124-MIGRATIONS.md.
- Fresh wiped macOS and bare-metal Linux boot acceptance were not performed. Historical Mac runtime/LaunchAgent acceptance plus native CI, Docker Debian real systemd, and isolated WSL fresh/upgrade are the available evidence.
- Windows Edge acceptance is historical at its recorded checkpoint. WSL Chromium exercised the latest Canvas session change. The earlier WSLInterop absence is resolved in the current environment without a host write; post-main Windows Edge fixture acceptance passed (operator-adoption.json).
- Dependency modernization, comprehensive docs/skill semantics and remaining source review stay in this backlog. Do not move these into spec125 by implication.

- Siri fast-result subscription begins after pending-turn persistence. A result arriving during that write can require existing stale-turn reconciliation; investigate buffered delivery in a follow-up. Fast-window tests now explicitly synchronize after persistence instead of assuming disk I/O finishes in10ms. This is a recoverable delivery limitation, not a confirmed safe-use release blocker.
