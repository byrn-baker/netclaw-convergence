---
name: synology-nas-monitor
description: "Synology NAS health monitoring via SNMP metrics in Prometheus/VictoriaMetrics — disk health, RAID status, temperature, storage utilization, power supply, and uptime. Use when checking NAS health, investigating storage alerts, or monitoring disk temperatures."
version: 1.0.0
tags: [synology, nas, storage, raid, snmp, monitoring, health]
---

# Synology NAS Monitor

## Overview

Monitors Synology NAS devices via SNMP metrics stored in Prometheus or VictoriaMetrics. Uses the `prometheus-monitoring` skill's MCP tools for all queries.

## Prerequisites

- Synology NAS with SNMP enabled (Control Panel → Terminal & SNMP → SNMP)
- SNMP poller (OTEL Collector, Telegraf, etc.) scraping the NAS and writing to Prometheus/VictoriaMetrics
- Metrics tagged with `device_name` label matching the NAS hostname

## MCP Server

Uses `prometheus-mcp` (existing) — no new MCP server needed.

## Metric Reference

All metrics use OTEL naming conventions with unit suffixes:

| Metric | Description | Labels |
|--------|-------------|--------|
| `nas_system_temperature_celsius` | Chassis temperature | `device_name` |
| `nas_power_status_ratio` | Power supply: 1=Normal, 2=Failed | `device_name` |
| `nas_disk_status_ratio` | Per-disk: 1=Normal, 5=Crashed | `device_name`, `disk_id` |
| `nas_disk_temperature_celsius` | Per-disk temperature | `device_name`, `disk_id` |
| `nas_raid_status_ratio` | Per-volume: 1=Normal, 11=Degraded, 12=Crashed | `device_name`, `raid_name` |
| `nas_raid_free_bytes` | Free bytes per RAID volume | `device_name`, `raid_name` |
| `nas_raid_total_bytes` | Total bytes per RAID volume | `device_name`, `raid_name` |
| `system_uptime_seconds` | System uptime | `device_name` |
| `interface_in_octets_bytes_total` | Network interface RX bytes | `device_name`, `interface_name` |
| `interface_out_octets_bytes_total` | Network interface TX bytes | `device_name`, `interface_name` |

## Health Check Procedure

### Step 1: System Temperature

```
Query: nas_system_temperature_celsius{device_name="<NAS>"}
```

| Value | Severity |
|-------|----------|
| < 45°C | HEALTHY |
| 45-55°C | WARNING |
| > 55°C | CRITICAL |

### Step 2: Power Supply

```
Query: nas_power_status_ratio{device_name="<NAS>"}
```

| Value | Meaning | Severity |
|-------|---------|----------|
| 1 | Normal | HEALTHY |
| 2 | Failed | CRITICAL — immediate attention |

### Step 3: Disk Health

```
Query: nas_disk_status_ratio{device_name="<NAS>"}
```

Check each disk (labeled by `disk_id`):

| Value | Meaning | Severity |
|-------|---------|----------|
| 1 | Normal | HEALTHY |
| 2 | Initialized | INFO |
| 3 | Not initialized | WARNING |
| 4 | System partition failed | CRITICAL |
| 5 | Crashed | CRITICAL — disk replacement needed |

### Step 4: Disk Temperature

```
Query: nas_disk_temperature_celsius{device_name="<NAS>"}
```

Same thresholds as system temperature: WARNING > 45°C, CRITICAL > 55°C.

### Step 5: RAID Volume Status

```
Query: nas_raid_status_ratio{device_name="<NAS>"}
```

| Value | Meaning | Severity |
|-------|---------|----------|
| 1 | Normal | HEALTHY |
| 2-10 | Repairing/Migrating/Syncing | WARNING |
| 11 | Degraded | CRITICAL — redundancy lost |
| 12 | Crashed | CRITICAL — data at risk |

### Step 6: Storage Utilization

**IMPORTANT**: Only check Volume entries, not Storage Pool entries.

```
Query: nas_raid_free_bytes{raid_name=~"Volume.*"} / nas_raid_total_bytes{raid_name=~"Volume.*"}
```

Storage Pool entries showing 0 free bytes is **NORMAL** — it means all pool capacity is allocated to Volumes. This is correct Synology behavior. Never alert on Storage Pool free space.

| Free % | Severity |
|--------|----------|
| > 20% | HEALTHY |
| 10-20% | WARNING |
| < 10% | CRITICAL |

### Step 7: Uptime

```
Query: system_uptime_seconds{device_name="<NAS>"}
```

| Uptime | Severity |
|--------|----------|
| > 5 min | HEALTHY |
| < 5 min | WARNING — recent reboot, check why |

### Step 8: Missing Metrics

If any metric query returns empty results (no data points), this means SNMP is not configured or not being polled for that NAS device. Report a single INFO finding:

> "SNMP monitoring not active for {device_name} — enable SNMP in Synology Control Panel"

Do **NOT** report CRITICAL when metrics are simply absent. Absence ≠ failure.

## Integration with Other Skills

| Skill | How They Work Together |
|-------|----------------------|
| `prometheus-monitoring` | All metric queries go through this skill's MCP tools |
| `grafana-observability` | Check Grafana dashboards for NAS visualization |
| `nautobot-sot` | Verify NAS device is registered in Nautobot with correct IP |
| `pfsense-firewall-ops` | Identify NAS by MAC/IP in DHCP/ARP tables |

## Important Rules

- **Read-only** — monitoring only, no changes to NAS configuration
- **Volume vs Pool** — always filter `raid_name=~"Volume.*"` for storage alerts
- **Missing data** — report INFO, not CRITICAL, when SNMP metrics are absent
- **Record in GAIT** — log all health check results
