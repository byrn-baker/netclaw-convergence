---
name: pfsense-firewall-ops
description: "pfSense firewall management — DHCP leases, ARP table, interface status, firewall aliases/rules, gateway monitoring, state table analysis, and device identification. Use when investigating hosts on the network, checking firewall rules, auditing gateway health, or identifying devices by IP or MAC address."
version: 1.0.0
tags: [pfsense, firewall, dhcp, arp, gateway, security, network]
---

# pfSense Firewall Operations

## MCP Server

- **Server**: `pfsense-mcp` (built-in)
- **Transport**: stdio (FastMCP)
- **Auth**: `PFSENSE_HOST`, `PFSENSE_XMLRPC_USER`, `PFSENSE_XMLRPC_PASS`
- **Read-only**: Yes — no configuration changes via this skill

## Tools

| Tool | What It Does |
|------|-------------|
| `pfsense_get_dhcp_leases` | All active DHCP leases: IP, MAC, hostname, state |
| `pfsense_get_arp_table` | ARP table: IP → MAC → interface |
| `pfsense_get_system_info` | Version, hostname, uptime, CPU, memory, disk |
| `pfsense_get_interfaces` | Interface status, IPs, MAC, media, bytes in/out |
| `pfsense_get_firewall_aliases` | Firewall aliases and their address lists |
| `pfsense_get_firewall_rules` | Firewall rules by interface (default: wan) |
| `pfsense_get_gateway_status` | Gateway RTT, packet loss, status |
| `pfsense_get_states_summary` | State table total + top 10 source IPs by connections |

## Workflow: Identify a Device by IP

When asked "what device is at 192.168.x.x?":

1. `pfsense_get_dhcp_leases` — find the IP in active leases → get MAC + hostname
2. If not in DHCP (static IP): `pfsense_get_arp_table` — find IP → get MAC
3. Cross-reference MAC with Nautobot (`nautobot-sot` skill) for device role and switch port
4. Report: hostname, MAC, manufacturer (OUI), Nautobot device record, switch port

## Workflow: Gateway Health Check

1. `pfsense_get_gateway_status` — check all gateways
2. Flag: RTT > 100ms → WARNING, loss > 5% → WARNING, loss > 20% → CRITICAL
3. If gateway is down: check `pfsense_get_interfaces` for the WAN interface status
4. Report: gateway name, IP, RTT, loss, status

## Workflow: Firewall Rule Audit

1. `pfsense_get_firewall_rules(interface="wan")` — get WAN rules
2. Check for: overly permissive rules (any/any), disabled rules, rules with no description
3. `pfsense_get_firewall_aliases` — check alias contents for stale entries
4. Report: rule count, any security concerns, alias hygiene

## Workflow: State Table Analysis

1. `pfsense_get_states_summary` — get total states and top talkers
2. Flag: total states > 100,000 → WARNING (state table exhaustion risk)
3. Check top source IPs — are any unexpected? Cross-reference with Nautobot
4. Report: state count, top talkers with device identification

## Workflow: Network Device Discovery

Build a complete picture of what's on the network:

1. `pfsense_get_dhcp_leases` — all DHCP clients
2. `pfsense_get_arp_table` — all devices seen (including static IPs)
3. Merge by MAC address (DHCP preferred for hostname)
4. Cross-reference with Nautobot for known devices
5. Flag any unknown MACs not in Nautobot → potential rogue devices
6. Report: device inventory with hostname, IP, MAC, Nautobot status

## Integration with Other Skills

| Skill | How They Work Together |
|-------|----------------------|
| `nautobot-sot` | Cross-reference pfSense DHCP/ARP with Nautobot device inventory |
| `grafana-observability` | Query Loki for pfSense syslog/filterlog entries |
| `prometheus-monitoring` | Query firewall metrics (block rates, interface counters) |
| `pyats-network` | SSH to switches to trace MAC addresses to physical ports |
| `nmap-network-scan` | Scan unknown hosts discovered via DHCP/ARP |

## Important Rules

- **Read-only** — never modify pfSense configuration through this skill
- **Blocking** — if you need to block an IP, use the automation pipeline (convergence-mcp `submit_block_action`), not direct pfSense changes
- **Credentials** — XML-RPC credentials are in environment variables, never expose them
- **SSL** — pfSense typically uses self-signed certs; SSL verification is disabled by default
- **Record in GAIT** — log all pfSense queries and device identification results
