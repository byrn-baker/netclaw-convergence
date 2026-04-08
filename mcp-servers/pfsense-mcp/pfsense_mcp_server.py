#!/usr/bin/env python3
"""pfSense MCP Server — read-only pfSense management via XML-RPC exec_php.

Tools: pfsense_get_dhcp_leases, pfsense_get_arp_table, pfsense_get_interfaces,
       pfsense_get_system_info, pfsense_get_firewall_aliases, pfsense_get_firewall_rules,
       pfsense_get_gateway_status, pfsense_get_states_summary

Transport: stdio
Read-only: Yes — no configuration changes. Blocking goes through automation pipelines.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape as xml_escape

import httpx
from mcp.server.fastmcp import FastMCP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - pfsense-mcp - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("pfsense-mcp")

PFSENSE_HOST = os.getenv("PFSENSE_HOST", "")
PFSENSE_USER = os.getenv("PFSENSE_XMLRPC_USER", "admin")
PFSENSE_PASS = os.getenv("PFSENSE_XMLRPC_PASS", "")
PFSENSE_VERIFY_SSL = os.getenv("PFSENSE_VERIFY_SSL", "false").lower() == "true"
XMLRPC_TIMEOUT = 20.0

mcp = FastMCP("pfsense-mcp")


# ── XML-RPC exec_php core ─────────────────────────────────────────────────

async def _exec_php(php_code: str) -> str:
    """Execute PHP on pfSense via XML-RPC exec_php and return echo output.

    pfSense prepends PHP echo output before the XML-RPC envelope, so we
    parse the response manually: split at <?xml, return the echo portion,
    and check the XML envelope for faults.
    """
    if not PFSENSE_HOST or not PFSENSE_PASS:
        raise RuntimeError("PFSENSE_HOST or PFSENSE_XMLRPC_PASS not configured")

    url = f"https://{PFSENSE_HOST}/xmlrpc.php"
    xml_body = (
        '<?xml version="1.0"?>'
        "<methodCall>"
        "<methodName>pfsense.exec_php</methodName>"
        "<params><param>"
        f"<value><string>{xml_escape(php_code)}</string></value>"
        "</param></params>"
        "</methodCall>"
    )

    async with httpx.AsyncClient(verify=PFSENSE_VERIFY_SSL, timeout=XMLRPC_TIMEOUT) as client:
        resp = await client.post(
            url,
            content=xml_body.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            auth=(PFSENSE_USER, PFSENSE_PASS),
        )

    if resp.status_code == 401:
        raise RuntimeError("Authentication failed")
    if not resp.is_success:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")

    body = resp.text
    xml_start = body.find("<?xml")
    if xml_start < 0:
        raise RuntimeError(f"No XML-RPC envelope in response: {body[:200]!r}")

    echo_output = body[:xml_start].strip()
    xml_part = body[xml_start:]

    root = ET.fromstring(xml_part)
    if root.find(".//fault") is not None:
        msg = "XML-RPC fault"
        for member in root.findall(".//struct/member"):
            if member.findtext("name", "") == "faultString":
                msg = member.findtext("value/string", msg)
        raise RuntimeError(msg)

    return echo_output


def _safe(func):
    """Decorator: catch exceptions and return JSON error instead of crashing."""
    import functools

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            return json.dumps({"error": str(e)})

    return wrapper


# ── Tools ─────────────────────────────────────────────────────────────────

@mcp.tool()
@_safe
async def pfsense_get_dhcp_leases() -> str:
    """Get all active DHCP leases from pfSense.
    Returns IP, MAC address, hostname, and lease state for each client."""
    php = r"""
$leases = [];
$content = @file_get_contents('/var/dhcpd/var/db/dhcpd.leases');
if ($content) {
    preg_match_all('/lease\s+([\d.]+)\s*\{([^}]+)\}/s', $content, $blocks, PREG_SET_ORDER);
    $seen = [];
    foreach (array_reverse($blocks) as $block) {
        $ip = $block[1];
        if (isset($seen[$ip])) continue;
        $seen[$ip] = true;
        $body = $block[2];
        $entry = ['ip' => $ip, 'mac' => '', 'hostname' => '', 'state' => 'unknown'];
        if (preg_match('/binding\s+state\s+(\w+);/', $body, $m)) $entry['state'] = $m[1];
        if (preg_match('/hardware\s+ethernet\s+([\da-f:]+);/i', $body, $m)) $entry['mac'] = strtolower($m[1]);
        if (preg_match('/client-hostname\s+"([^"]+)";/', $body, $m)) $entry['hostname'] = $m[1];
        $leases[] = $entry;
    }
}
echo json_encode($leases);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_arp_table() -> str:
    """Get the ARP table from pfSense. Returns IP to MAC address mappings
    with the network interface each entry was learned on."""
    php = r"""
$entries = [];
exec('arp -an', $lines);
foreach ($lines as $line) {
    if (preg_match('/\(?(\d+\.\d+\.\d+\.\d+)\)?\s+at\s+([\da-f:]+)\s+on\s+(\S+)/i', $line, $m)) {
        $entries[] = ['ip' => $m[1], 'mac' => strtolower($m[2]), 'interface' => $m[3]];
    }
}
echo json_encode($entries);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_system_info() -> str:
    """Get pfSense system information: version, hostname, uptime, CPU usage,
    memory usage, disk usage, and kernel version."""
    php = r"""
$info = [
    'hostname' => gethostname(),
    'version' => @file_get_contents('/etc/version') ?: 'unknown',
    'uptime' => trim(shell_exec('uptime') ?: ''),
    'cpu_count' => (int)trim(shell_exec('sysctl -n hw.ncpu') ?: '0'),
    'memory_total_mb' => round((int)trim(shell_exec('sysctl -n hw.physmem') ?: '0') / 1048576),
    'memory_used_pct' => 0,
    'disk_usage' => [],
    'kernel' => trim(shell_exec('uname -r') ?: ''),
];
$mem = shell_exec('sysctl vm.stats.vm.v_page_count vm.stats.vm.v_free_count');
if (preg_match('/v_page_count:\s*(\d+)/', $mem, $m1) && preg_match('/v_free_count:\s*(\d+)/', $mem, $m2)) {
    $total = (int)$m1[1]; $free = (int)$m2[1];
    if ($total > 0) $info['memory_used_pct'] = round(($total - $free) / $total * 100, 1);
}
exec('df -h /', $df);
if (count($df) > 1) $info['disk_usage'] = $df[1];
echo json_encode($info);
"""
    output = await _exec_php(php)
    return output if output else "{}"


@mcp.tool()
@_safe
async def pfsense_get_interfaces() -> str:
    """Get pfSense network interface status: name, IP address, subnet,
    status (up/down), MAC address, media type, and bytes in/out."""
    php = r"""
require_once("/etc/inc/interfaces.inc");
$ifaces = [];
$config_ifs = function_exists('config_get_path')
    ? config_get_path('interfaces', [])
    : ($GLOBALS['config']['interfaces'] ?? []);
foreach ($config_ifs as $ifname => $ifcfg) {
    $realif = get_real_interface($ifname);
    $status = get_interface_info($ifname);
    $ifaces[] = [
        'name' => $ifname,
        'descr' => $ifcfg['descr'] ?? $ifname,
        'device' => $realif,
        'ipaddr' => $status['ipaddr'] ?? ($ifcfg['ipaddr'] ?? ''),
        'subnet' => $ifcfg['subnet'] ?? '',
        'status' => $status['status'] ?? 'unknown',
        'mac' => $status['macaddr'] ?? '',
        'media' => $status['media'] ?? '',
        'bytes_in' => $status['inbytes'] ?? 0,
        'bytes_out' => $status['outbytes'] ?? 0,
    ];
}
echo json_encode($ifaces);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_firewall_aliases() -> str:
    """Get all firewall aliases from pfSense. Returns alias name, type,
    description, and the list of addresses/networks in each alias."""
    php = r"""
$aliases = function_exists('config_get_path')
    ? config_get_path('aliases/alias', [])
    : ($GLOBALS['config']['aliases']['alias'] ?? []);
$result = [];
foreach ($aliases as $a) {
    $addrs = array_values(array_filter(preg_split('/\s+/', trim($a['address'] ?? ''))));
    $result[] = [
        'name' => $a['name'] ?? '',
        'type' => $a['type'] ?? '',
        'descr' => $a['descr'] ?? '',
        'address_count' => count($addrs),
        'addresses' => array_slice($addrs, 0, 50),
    ];
}
echo json_encode($result);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_firewall_rules(interface: str = "wan") -> str:
    """Get firewall rules for a specific interface (default: wan).
    Returns rule type, source, destination, port, protocol, and description."""
    php = f"""
$rules = function_exists('config_get_path')
    ? config_get_path('filter/rule', [])
    : ($GLOBALS['config']['filter']['rule'] ?? []);
$result = [];
foreach ($rules as $r) {{
    $rif = $r['interface'] ?? '';
    if ($rif !== '{interface}' && '{interface}' !== 'all') continue;
    $result[] = [
        'interface' => $rif,
        'type' => $r['type'] ?? 'pass',
        'ipprotocol' => $r['ipprotocol'] ?? 'inet',
        'protocol' => $r['protocol'] ?? 'any',
        'source' => $r['source'] ?? [],
        'destination' => $r['destination'] ?? [],
        'descr' => $r['descr'] ?? '',
        'disabled' => isset($r['disabled']),
        'tracker' => $r['tracker'] ?? '',
    ];
}}
echo json_encode($result);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_gateway_status() -> str:
    """Get gateway monitoring status from pfSense. Returns gateway name,
    IP, RTT, loss percentage, and status for each configured gateway."""
    php = r"""
require_once("/etc/inc/gwlb.inc");
$gws = return_gateways_status(true);
$result = [];
foreach ($gws as $name => $gw) {
    $result[] = [
        'name' => $name,
        'gateway' => $gw['monitorip'] ?? ($gw['gateway'] ?? ''),
        'rtt' => $gw['delay'] ?? '',
        'loss' => $gw['loss'] ?? '',
        'status' => $gw['status'] ?? 'unknown',
        'substatus' => $gw['substatus'] ?? '',
    ];
}
echo json_encode($result);
"""
    output = await _exec_php(php)
    return output if output else "[]"


@mcp.tool()
@_safe
async def pfsense_get_states_summary() -> str:
    """Get firewall state table summary: total states, states by interface,
    and the top 10 source IPs by connection count."""
    php = r"""
$total = (int)trim(shell_exec('pfctl -si 2>/dev/null | grep "current entries" | awk "{print \\$3}"') ?: '0');
$top_src = [];
exec('pfctl -ss 2>/dev/null | awk "{print \\$3}" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10', $lines);
foreach ($lines as $line) {
    if (preg_match('/^\s*(\d+)\s+(.+)/', $line, $m)) {
        $top_src[] = ['ip' => trim($m[2]), 'count' => (int)$m[1]];
    }
}
echo json_encode(['total_states' => $total, 'top_sources' => $top_src]);
"""
    output = await _exec_php(php)
    return output if output else '{"total_states": 0, "top_sources": []}'


if __name__ == "__main__":
    logger.info("Starting pfSense MCP Server (stdio transport)")
    mcp.run(transport="stdio")
