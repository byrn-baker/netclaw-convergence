# pfSense MCP Server

Read-only MCP server for pfSense firewall management via XML-RPC `exec_php`.

## Tools

| Tool | Description |
|------|-------------|
| `pfsense_get_dhcp_leases` | Active DHCP leases (IP, MAC, hostname, state) |
| `pfsense_get_arp_table` | ARP table (IP → MAC → interface) |
| `pfsense_get_system_info` | Version, hostname, uptime, CPU, memory, disk |
| `pfsense_get_interfaces` | Interface status, IPs, MAC, media, bytes in/out |
| `pfsense_get_firewall_aliases` | Firewall aliases and their contents |
| `pfsense_get_firewall_rules` | Firewall rules by interface |
| `pfsense_get_gateway_status` | Gateway monitoring (RTT, loss, status) |
| `pfsense_get_states_summary` | State table total + top 10 source IPs |

## Setup

```bash
pip install -r requirements.txt
PFSENSE_HOST=192.168.1.1 PFSENSE_XMLRPC_PASS=secret python3 pfsense_mcp_server.py
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PFSENSE_HOST` | Yes | — | pfSense hostname or IP (with optional :port) |
| `PFSENSE_XMLRPC_USER` | No | `admin` | XML-RPC username |
| `PFSENSE_XMLRPC_PASS` | Yes | — | XML-RPC password |
| `PFSENSE_VERIFY_SSL` | No | `false` | Verify SSL certificate |

## OpenClaw Registration

```json
{
  "mcpServers": {
    "pfsense-mcp": {
      "command": "python3",
      "args": ["-u", "/path/to/pfsense_mcp_server.py"],
      "env": {
        "PFSENSE_HOST": "192.168.1.1",
        "PFSENSE_XMLRPC_USER": "admin",
        "PFSENSE_XMLRPC_PASS": "${PFSENSE_XMLRPC_PASS}"
      }
    }
  }
}
```

## Security

- **Read-only** — no configuration changes, no write operations
- Blocking/unblocking should go through a separate automation pipeline with audit trail
- XML-RPC credentials are passed via environment variables, never hardcoded
- SSL verification disabled by default for self-signed pfSense certs

## Compatibility

- pfSense CE 2.7+ and pfSense Plus 23.09+
- Uses `exec_php` XML-RPC method (available on all pfSense versions)
- PHP code uses `config_get_path()` with fallback to `$config[]` for older versions
