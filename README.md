<p align="center">
  <img src="netclaw.jpg" alt="NetClaw — A CCIE-level AI agent that claws through your network" width="600">
</p>

# NetClaw + Convergence

A CCIE-level AI network operations center for a home network. [NetClaw](https://github.com/automateyournetwork/netclaw) runs natively as the AI brain — monitoring, investigating, and acting on network events. The Convergence telemetry stack runs in Docker — collecting SNMP, syslog, and NetFlow from network devices, storing metrics and logs, enriching threat intelligence, and executing firewall actions.

> **This is the `convergence` branch** — a deployment-specific fork of NetClaw for a home lab with Cisco 3850 switches, a pfSense firewall, Synology NAS devices, and the full observability stack. The `main` branch tracks upstream NetClaw. The `upstream/contributions` branch holds generic additions (pfSense MCP server, skills) ready to PR upstream.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NetClaw (runs natively)                    │
│                                                              │
│  OpenClaw Gateway (port 18789) + REST Proxy (port 18790)     │
│                                                              │
│  Named Agents:                                               │
│    main        → your questions (Discord, browser, CLI)      │
│    noc         → convergence-noc-watch skill                 │
│    security    → convergence-security-monitor skill          │
│    reconciler  → convergence-interface-reconciler skill      │
│                                                              │
│  MCP Servers:                                                │
│    pfsense-mcp · convergence-mcp · grafana-mcp               │
│    prometheus-mcp · nautobot-mcp · pyats-mcp · nmap-mcp      │
│                                                              │
│  124+ skills · pyATS + Genie · GAIT audit trail              │
└──────────────────────────┬──────────────────────────────────┘
                           │ localhost ports
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────┐
│              Convergence Stack (Docker Compose)               │
│                                                               │
│  Telemetry:    OTEL Collector → VictoriaMetrics (metrics)     │
│                              → Promtail → Loki (logs)         │
│  Visualization: Grafana (9 dashboards)                        │
│  Alerting:     Alertmanager → Discord                         │
│  Enrichment:   threat-intel (AbuseIPDB, GreyNoise, OTX)      │
│  Execution:    automation-agent (pfSense blocking + GAIT)     │
│  Scheduling:   convergence-scheduler (cron + Discord)         │
│  State:        Redis                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Ubuntu 22.04+ (or any Linux with Docker)
- Docker + Docker Compose
- Node.js 22+ and npm
- Python 3.11+
- Network devices reachable from this host (switches on 192.168.3.x, pfSense, Nautobot)

### 1. Clone and Install NetClaw

```bash
git clone git@github.com:byrn-baker/netclaw.git
cd netclaw
git checkout convergence

# Install NetClaw (53 steps — MCP servers, pyATS, skills, OpenClaw)
./scripts/install.sh
```

### 2. Configure NetClaw

```bash
# Interactive setup — pick your LLM provider, configure gateway
openclaw onboard

# Configure network platform credentials
./scripts/setup.sh
```

### 3. Set Up Environment

Copy and edit the environment file:

```bash
cp .env.example .env
# Edit .env with your actual credentials:
#   SWITCH_SSH_USER, SWITCH_SSH_PASS, SWITCH_SSH_ENABLE_PASS
#   PFSENSE_HOST, PFSENSE_XMLRPC_USER, PFSENSE_XMLRPC_PASS
#   NAUTOBOT_URL, NAUTOBOT_TOKEN
#   DISCORD_WEBHOOK_URL, DISCORD_BOT_TOKEN
#   ABUSEIPDB_API_KEY, OTX_API_KEY, IPINFO_TOKEN
#   OLLAMA_API_KEY (for Ollama Cloud)
```

### 4. Register MCP Servers

Source your credentials and register the MCP servers NetClaw needs:

```bash
. .env

# pfSense firewall management (8 tools)
openclaw mcp set pfsense-mcp "{\"name\":\"pfsense-mcp\",\"type\":\"stdio\",\"command\":\"python3\",\"args\":[\"-u\",\"mcp-servers/pfsense-mcp/pfsense_mcp_server.py\"],\"env\":{\"PFSENSE_HOST\":\"$PFSENSE_HOST\",\"PFSENSE_XMLRPC_USER\":\"${PFSENSE_XMLRPC_USER:-admin}\",\"PFSENSE_XMLRPC_PASS\":\"$PFSENSE_XMLRPC_PASS\"}}"

# Convergence services bridge (10 tools)
openclaw mcp set convergence-mcp "{\"name\":\"convergence-mcp\",\"type\":\"stdio\",\"command\":\"python3\",\"args\":[\"-u\",\"mcp-servers/convergence-mcp/convergence_mcp_server.py\"],\"env\":{\"THREAT_INTEL_URL\":\"http://localhost:8001\",\"AUTOMATION_AGENT_URL\":\"http://localhost:8002\",\"VICTORIAMETRICS_URL\":\"http://localhost:8428\",\"LOKI_URL\":\"http://localhost:3100\",\"PFSENSE_HOST\":\"$PFSENSE_HOST\",\"PFSENSE_XMLRPC_USER\":\"${PFSENSE_XMLRPC_USER:-admin}\",\"PFSENSE_XMLRPC_PASS\":\"$PFSENSE_XMLRPC_PASS\",\"NAUTOBOT_URL\":\"$NAUTOBOT_URL\",\"NAUTOBOT_TOKEN\":\"$NAUTOBOT_TOKEN\"}}"

# Grafana observability (75+ tools — PromQL, LogQL, dashboards, alerts)
openclaw mcp set grafana-mcp "{\"name\":\"grafana-mcp\",\"type\":\"stdio\",\"command\":\"uvx\",\"args\":[\"mcp-grafana\"],\"env\":{\"GRAFANA_URL\":\"http://localhost:3000\",\"GRAFANA_USERNAME\":\"admin\",\"GRAFANA_PASSWORD\":\"${GRAFANA_ADMIN_PASSWORD:-admin}\"}}"

# Prometheus/VictoriaMetrics (PromQL queries)
openclaw mcp set prometheus-mcp "{\"name\":\"prometheus-mcp\",\"type\":\"stdio\",\"command\":\"prometheus-mcp-server\",\"env\":{\"PROMETHEUS_URL\":\"http://localhost:8428\"}}"

# Verify registration
openclaw mcp list
```

### 5. Start the Telemetry Stack

```bash
docker compose up -d
```

This starts: OTEL Collector, VictoriaMetrics, Grafana, Loki, Promtail, Alertmanager, Redis, threat-intel, automation-agent, and convergence-scheduler.

Verify:
```bash
docker compose ps                              # all containers healthy
curl -s http://localhost:8428/api/v1/status     # VictoriaMetrics
curl -s http://localhost:3000/api/health        # Grafana
curl -s http://localhost:8001/health            # threat-intel
curl -s http://localhost:8002/health            # automation-agent
```

### 6. Start NetClaw

```bash
# Terminal 1: OpenClaw gateway
openclaw gateway run

# Terminal 2: REST proxy (for scheduler access)
python3 mcp-servers/netclaw-proxy/netclaw_proxy.py

# Terminal 3 (optional): Visual HUD
cd ui/netclaw-visual && npm install && npm run dev
```

### 7. Verify Everything Works

```bash
# Test pfSense MCP
openclaw agent --message "Use pfsense_get_system_info to show me pfSense status"

# Test Grafana MCP
openclaw agent --message "Use grafana-mcp to list available dashboards"

# Test a monitoring skill
openclaw agent --message "Run the convergence-noc-watch skill"
```

---

## What's Running

### NetClaw (native on host)

| Component | Port | Purpose |
|-----------|------|---------|
| OpenClaw Gateway | 18789 | WebSocket API, browser chat, device pairing |
| REST Proxy | 18790 | HTTP→CLI bridge for scheduler |
| Visual HUD | 3000 (dev) | Three.js 3D operations dashboard |

### Docker Compose Stack

| Service | Port | Purpose |
|---------|------|---------|
| OTEL Collector | 514/udp, 2055/udp, 4317 | SNMP, syslog, NetFlow ingestion |
| VictoriaMetrics | 8428 | Metrics storage (90d retention) |
| Grafana | 3000 | 9 dashboards |
| Loki | 3100 | Log aggregation |
| Alertmanager | 9093 | Alert routing |
| Redis | 6379 | Caching and state |
| threat-intel | 8001 | IP enrichment (AbuseIPDB, GreyNoise, OTX, IPInfo) |
| automation-agent | 8002 | pfSense blocking with GAIT audit trail |
| convergence-scheduler | 8004 | Cron triggers + Discord notifications |

---

## Named Agents

NetClaw runs four concurrent agents, each with its own session:

| Agent | Skill | What It Does |
|-------|-------|-------------|
| `main` | (interactive) | Your questions via Discord, browser chat, or CLI |
| `noc` | convergence-noc-watch | Device health, interface utilization, error rates, firewall block rates |
| `security` | convergence-security-monitor | Threat hunting, NetFlow analysis, Nautobot validation, block submissions |
| `reconciler` | convergence-interface-reconciler | Nautobot ↔ switch sync, port descriptions, admin state |

The scheduler triggers `noc`, `security`, and `reconciler` every 10 minutes. `main` is always available for interactive use.

---

## MCP Servers

### Convergence-Specific (this branch only)

| Server | Tools | Description |
|--------|-------|-------------|
| `pfsense-mcp` | 8 | pfSense XML-RPC: DHCP, ARP, interfaces, aliases, rules, gateways, states |
| `convergence-mcp` | 10 | Bridge to threat-intel, automation-agent, VictoriaMetrics, Loki |
| `netclaw-proxy` | — | REST proxy sidecar for programmatic access |

### Upstream NetClaw (registered via `openclaw mcp set`)

| Server | Tools | Description |
|--------|-------|-------------|
| `grafana-mcp` | 75+ | PromQL, LogQL, dashboards, alerting, incidents |
| `prometheus-mcp` | 6 | PromQL queries, metric discovery, scrape targets |
| `nautobot-mcp` | 5 | IPAM: IP addresses, prefixes, VRF/tenant |
| `pyats-mcp` | 10+ | SSH, show commands, Genie parsers, config management |
| `nmap-mcp` | 6 | Network scanning, service detection |
| `gait-mcp` | 5 | Audit trail for all AI decisions |

---

## Skills

### Convergence-Specific

| Skill | Uses | Replaces |
|-------|------|----------|
| `convergence-noc-watch` | grafana-mcp, prometheus-mcp, nautobot-mcp | NOC Officer + Network Engineer agents |
| `convergence-security-monitor` | grafana-mcp, convergence-mcp, nautobot-mcp, pfsense-mcp | Security Expert + Security Engineer agents |
| `convergence-interface-reconciler` | pyats-mcp, nautobot-mcp, pfsense-mcp | Interface Reconciler agent |

### Upstream (contributed back)

| Skill | Uses | Description |
|-------|------|-------------|
| `pfsense-firewall-ops` | pfsense-mcp | pfSense management workflows |
| `synology-nas-monitor` | prometheus-mcp | Synology SNMP health checks |

---

## Branch Strategy

| Branch | Purpose | Syncs With |
|--------|---------|------------|
| `main` | Clean upstream NetClaw | `automateyournetwork/netclaw` |
| `upstream/contributions` | PR-ready generic additions | PR → upstream |
| `convergence` | This deployment | Merges from `main` |

To sync with upstream:
```bash
git fetch origin
git checkout main
git pull upstream main        # (add upstream remote first)
git checkout convergence
git merge main                # bring upstream changes into your deployment
```

---

## Makefile

```bash
make up          # Start Docker stack
make down        # Stop Docker stack
make restart     # Restart all containers
make logs        # Tail all container logs
make health      # Check service health
make build       # Rebuild custom service images
make status      # Comprehensive status check
```

---

## Visual HUD

NetClaw includes a Three.js 3D operations dashboard. From the browser, you can chat with NetClaw, watch MCP integrations light up as tools execute, and inspect the network topology.

```bash
cd ui/netclaw-visual
npm install
npm run dev       # opens at http://localhost:3000
```

Requires the OpenClaw gateway to be running.

---

## Discord Integration

The convergence-scheduler posts to Discord:
- **CRITICAL/WARNING findings** — posted immediately with 30-minute dedup
- **Hourly shift reports** — summary of all findings grouped by agent
- **Interactive questions** — ask NetClaw questions via the Discord bot

---

## Troubleshooting

**NetClaw can't reach Docker services:**
MCP servers use `localhost:PORT` since Docker ports are mapped to the host. Verify with `curl http://localhost:8428/api/v1/status`.

**Session file locks:**
If NetClaw crashes mid-run, stale `.lock` files may remain:
```bash
rm -f ~/.openclaw/agents/*/sessions/*.lock
```

**MCP server not responding:**
Check registration: `openclaw mcp list` and `openclaw mcp show <name>`. Verify credentials are literal values (not `${VAR}` references).

**Grafana shows no data:**
Verify OTEL Collector is receiving SNMP: `curl http://localhost:8428/api/v1/label/__name__/values | python3 -m json.tool | head -20`

---

## Project History

This deployment started as the [Convergence](https://github.com/byrn-baker/Convergence) project — a standalone network observability platform. Over 10 phases, it evolved from dashboards to AI agents to a full NetClaw integration. The decision to make NetClaw the primary project is documented in the [blog posts](https://github.com/byrn-baker/netclaw/tree/convergence/docs).

Key phases:
- **Phases 1-3:** Telemetry stack (OTEL, VictoriaMetrics, Loki, Grafana)
- **Phase 4:** Threat intelligence enrichment
- **Phase 5:** Automated pfSense blocking with GAIT audit
- **Phase 6-8:** LLM abstraction, multi-agent NOC team
- **Phase 9:** NetClaw MCP integration (pfsense-mcp, convergence-mcp)
- **Phase 10:** Retired custom agents, migrated to NetClaw skills
- **Current:** NetClaw-first architecture, native deployment
