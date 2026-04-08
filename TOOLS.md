# TOOLS.md — Local Infrastructure Notes

Skills define *how* tools work. This file is for *your* specifics — the environment details that are unique to your deployment.

## Network Devices

Devices are defined in `testbed/testbed.yaml`. These are the SSH-accessible Cisco switches:

```
### Device Map
- HomeSwitch01 → 192.168.3.2, Access Switch, Cisco WS-C3850-48P, IOS-XE
- HomeSwitch02 → 192.168.3.3, Access Switch, Cisco WS-C3850-48P, IOS-XE
- pfSense-FW01 → 192.168.3.1:440, Netgate pfSense Plus 25.11 (XML-RPC, not SSH)
- SynologyNAS01 → 192.168.100.22, Synology NAS (SNMP only, no SSH)
- SynologyNAS02 → 192.168.100.23, Synology NAS (SNMP only, no SSH)
```

### WS-C3850-48P Hardware Notes

- 48x GigabitEthernet1/0/1-48 access ports (1G PoE+)
- 4x TenGigabitEthernet1/1/1-4 uplink ports (10G SFP+)
- 4x GigabitEthernet1/1/1-4 combo ports — **shared with Te1/1/1-4**
  - When SFP+ is inserted and Te1/1/x is active, Gi1/1/x is automatically disabled by IOS
  - This is expected hardware behavior, NOT a fault
- StackWise ports: StackPort1, StackPort2 — ignore in inventory reconciliation

## Platform Credentials

All credentials are in `.env` at the project root. Never put credentials in skill files or this document.

```
### Connection Details (reference only — actual values in .env)
- pyATS Testbed       → PYATS_TESTBED_PATH (default: testbed/testbed.yaml)
- Nautobot            → NAUTOBOT_URL, NAUTOBOT_TOKEN
- pfSense XML-RPC     → PFSENSE_HOST, PFSENSE_XMLRPC_USER, PFSENSE_XMLRPC_PASS
- Switch SSH          → SWITCH_SSH_USER, SWITCH_SSH_PASS, SWITCH_SSH_ENABLE_PASS
- Discord             → DISCORD_WEBHOOK_URL, DISCORD_BOT_TOKEN
- Threat Intel APIs   → ABUSEIPDB_API_KEY, GREYNOISE_API_KEY, OTX_API_KEY, IPINFO_TOKEN
- LLM Provider        → OLLAMA_API_KEY (Ollama Cloud via openai-completions)
```

## Convergence Telemetry Stack (Docker on this host)

All services run via `docker compose up -d` from the project root.

```
### Service Map (all on localhost)
- VictoriaMetrics     → http://localhost:8428  (metrics storage, 90d retention)
- Grafana             → http://localhost:3000  (9 dashboards)
- Loki                → http://localhost:3100  (log aggregation)
- OTEL Collector      → ports 514/udp (syslog), 2055/udp (NetFlow), 4317 (OTLP gRPC)
- Alertmanager        → http://localhost:9093
- Redis               → localhost:6379
- threat-intel        → http://localhost:8001  (IP enrichment + AI narratives)
- automation-agent    → http://localhost:8002  (pfSense blocking, execute-only)
- convergence-scheduler → http://localhost:8004 (cron + Discord notifications)
```

## Grafana Dashboards

9 pre-built dashboards provisioned automatically:

| Dashboard | UID | What It Shows |
|-----------|-----|---------------|
| Network Overview | convergence-network-overview | Device uptime, reachability, SNMP health |
| Interface Utilization | convergence-interface-utilization | Per-port bandwidth, top talkers |
| Interface Errors | convergence-interface-errors | CRC, drops, discards by interface |
| Device Health | net-device-health | CPU, memory, environment per device |
| Platform Health | convergence-platform-health | Stack, power, fan status |
| pfSense Firewall Security | pfsense-firewall-security | Block rates, top attackers, GeoIP map |
| Threat Analysis | security-threat-analysis | Enriched threat intel, composite scores |
| Threat Intelligence | convergence-threat-intelligence | AbuseIPDB, GreyNoise, OTX feeds |
| NAS Health | convergence-nas-health | Synology disk, RAID, temperature |
| Automation Agent | convergence-automation-agent | Block actions, approval status, GAIT |

## MCP Servers for This Deployment

These are the MCP servers that should be registered via `openclaw mcp set`:

| MCP Server | What It Does | Env Vars Needed |
|------------|-------------|-----------------|
| pfsense-mcp | pfSense XML-RPC (DHCP, ARP, interfaces, rules, gateways) | PFSENSE_HOST, PFSENSE_XMLRPC_USER, PFSENSE_XMLRPC_PASS |
| convergence-mcp | Convergence services (threat-intel, automation-agent, metrics, logs) | THREAT_INTEL_URL, AUTOMATION_AGENT_URL, VICTORIAMETRICS_URL, LOKI_URL |
| grafana-mcp | Grafana (75+ tools: PromQL, LogQL, dashboards, alerts) | GRAFANA_URL, GRAFANA_SERVICE_ACCOUNT_TOKEN |
| prometheus-mcp | Prometheus/VictoriaMetrics (PromQL queries, metric discovery) | PROMETHEUS_URL |
| nautobot-mcp | Nautobot IPAM (IP addresses, prefixes, VRF) | NAUTOBOT_URL, NAUTOBOT_TOKEN |
| pyats-mcp | pyATS (SSH, show commands, Genie parsers) | PYATS_TESTBED_PATH |
| nmap-mcp | nmap (network scanning, service detection) | — |
| gait-mcp | GAIT (audit trail for all AI decisions) | — |

## Known Behaviors (Do NOT Alert On)

- Blocked firewall scans are normal — pfSense blocks thousands of probes daily
- NAS devices talking to multiple VLANs is normal (backups, media, cameras)
- IoT devices on mDNS/AirPlay ports (5353, 7000, 7100) is normal
- Gi1/1/1-4 down when Te1/1/1-4 active is normal (combo uplinks)
- Storage Pool showing 0 free bytes in Synology SNMP is normal (capacity allocated to Volumes)
- Empty SNMP metric results = SNMP not configured on that device, not a failure
