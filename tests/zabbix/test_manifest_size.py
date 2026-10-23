"""Manifest ceiling and surface stability. Spec 083, FR-044, SC-021/SC-030.

Measured via a real MCP handshake against the vendored server in its venv — not estimated
from source, because the manifest is what the model actually receives.

The tool-count assertion exists because we adopted upstream: a future bump that explodes
3 tools into 237 (as one rejected candidate already does) must fail loudly here rather
than quietly consuming the context budget.
"""
from __future__ import annotations
import asyncio, os, subprocess, sys
from _harness import FAILURES, check, repo, run, skip  # noqa: F401

CEILING = 5000
EXPECTED_TOOLS = {"zabbix_api", "zabbix_api_docs", "zabbix_api_list"}
VENV_PY = os.environ.get(
    "NETCLAW_ZABBIX_VENV_PY",
    repo("mcp-servers", "zabbix-mcp", ".venv", "bin", "python"),
)

PROBE = r'''
import asyncio, json, os, sys
from fastmcp import Client
from fastmcp.client.transports import StdioTransport
async def main():
    env = dict(os.environ)
    env["ZABBIX_URL"] = "http://127.0.0.1:1"
    env["ZABBIX_TOKEN"] = "placeholder"
    env["READ_ONLY"] = "true"
    catalogs = []
    for mode in ('legacy', '2026-07-28'):
        transport = StdioTransport(command=sys.executable,
                                   args=["-u", sys.argv[1]], env=env)
        async with Client(transport, mode=mode) as client:
            tools = await client.list_tools()
            catalogs.append([t.model_dump(mode='json') for t in tools])
    assert catalogs[0] == catalogs[1], 'protocol catalogs differ'
    m = "\n".join(f"{t.name}\n{t.description or ''}\n{t.input_schema}" for t in tools)
    print(json.dumps({"names": [t.name for t in tools],
                      "chars": len(m), "lines": m.count("\n")}))
asyncio.run(main())
'''

def _probe():
    if not os.path.exists(VENV_PY):
        return None
    out = subprocess.run([VENV_PY, "-c", PROBE, repo("scripts", "zabbix-stdio.py")], capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError(f"Installed Zabbix MCP manifest probe failed (exit {out.returncode})")
    import json
    for line in reversed(out.stdout.strip().splitlines()):
        if line.startswith("{"):
            return json.loads(line)
    raise RuntimeError("Installed Zabbix MCP manifest probe returned no JSON")

_CACHE = {}

def _data():
    if "d" not in _CACHE:
        _CACHE["d"] = _probe()
    return _CACHE["d"]

def test_manifest_under_ceiling():
    d = _data()
    if not d:
        skip("manifest measurement", "venv not built or handshake failed")
        return
    tokens = d["chars"] // 4 + d["lines"]
    print(f"        measured manifest: {tokens} / {CEILING} tokens ({d['chars']} chars)")
    check(f"manifest is <= {CEILING} tokens", tokens <= CEILING, f"measured {tokens}")

def test_tool_surface_is_stable():
    d = _data()
    if not d:
        skip("tool surface", "venv not built")
        return
    names = set(d["names"])
    check("exactly three tools are exposed", len(names) == 3, f"got {len(names)}: {sorted(names)}")
    check("the tool names are the expected ones", names == EXPECTED_TOOLS,
          f"surface changed: {sorted(names)} — an upstream bump altered the contract")

def test_no_write_shaped_tool_appeared():
    d = _data()
    if not d:
        skip("write-shape guard", "venv not built")
        return
    bad = [n for n in d["names"]
           if any(v in n.lower() for v in ("create", "update", "delete", "ack", "set", "write"))]
    check("no tool name implies a write", not bad, f"write-shaped tools appeared: {bad}")

TESTS = [test_manifest_under_ceiling, test_tool_surface_is_stable, test_no_write_shaped_tool_appeared]

if __name__ == "__main__":
    raise SystemExit(run(TESTS, "manifest and surface"))
