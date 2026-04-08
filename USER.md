# User Profile

## About You

- **Name:** Byrn Baker
- **Role:** Network Engineer / Home Lab Operator
- **Timezone:** America/Chicago

## Preferences

- **Communication style:** Technical, concise — include CLI output and protocol details
- **Report format:** Severity-sorted tables with HEALTHY / WARNING / CRITICAL ratings
- **Change management:** Nautobot is the source of truth for admin state — sync to switches
- **Escalation:** Post CRITICAL and WARNING to Discord immediately; suppress INFO
- **Blocking protocol:** Never block individual /32s from scanner ASNs — use pfBlockerNG for ASN-level blocking. Reserve submit_block_action for confirmed compromise only.

## Your Network

- **Testbed:** Defined in `testbed/testbed.yaml`
- **Platforms:** IOS-XE (Cisco WS-C3850-48P), pfSense Plus 25.11
- **Source of Truth:** Nautobot (read-write) at https://192.168.3.253
- **Firewall:** pfSense-FW01 at 192.168.3.1:440 (XML-RPC)
- **NAS:** SynologyNAS01 (192.168.100.22), SynologyNAS02 (192.168.100.23)
- **Monitoring:** VictoriaMetrics (localhost:8428), Loki (localhost:3100), Grafana (localhost:3000)
- **Threat Intel:** Convergence threat-intel service (localhost:8001)
- **Automation:** Convergence automation-agent (localhost:8002) — execute-only, no independent polling

## Subnets

- 192.168.1.0/24 — LAN
- 192.168.3.0/24 — Management
- 192.168.100.0/24 — Servers / Infrastructure
- 192.168.102.0/24 — IoT / Media

## Notes

- SynologyNAS01/02 talk to multiple VLANs — this is normal (backups, media, cameras, Docker). Do NOT flag as suspicious.
- IoT devices use mDNS/AirPlay on ports 5353, 7000, 7100 — this is normal.
- WS-C3850-48P combo uplinks: Gi1/1/1-4 disabled when Te1/1/1-4 active = normal hardware behavior.
- pfSense `system_get_dhcp_leases()` was removed in Plus 25.11 — use direct lease file parsing.
- Automation-agent has POLL_ENABLED=false — it only executes block requests from NetClaw, does not decide what to block independently.
- Discord is the notification channel for all alerts and shift reports.
