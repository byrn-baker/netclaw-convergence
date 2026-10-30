#!/usr/bin/env python3
"""Bounded native Hermes discovery; never invokes a tool or model.

The HUD companion intentionally exposes only its protected allowlist. Other
selected components must prove discovery in the pinned native Hermes registry.
Cached schemas alone do not establish a live connection.
"""
import json
import copy
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_state import guarded_read


def live_registered(server,expected,names,connections,registry,prefixed):
    matches=[v for v in connections.values() if v.name==server]
    if len(matches)!=1:return False
    connection=matches[0]
    if connection.session is None or connection._error is not None or not connection._ready.is_set():return False
    tools={tool.name for tool in connection._tools}
    if not tools or not set(expected)<=tools:return False
    # Require a live tool from this connection to be visible in the same native
    # registry used by the agent; a foreign/cached name is not sufficient.
    required=set(expected) or tools
    return all(prefixed(server,tool) in names and registry.get_toolset_for_tool(prefixed(server,tool))=='mcp-'+server for tool in required)


def discover(component):
    home=Path(os.environ.get('HERMES_HOME',''))
    if not home.is_absolute() or ROOT!=home/'.setup/source' or ROOT.resolve()!=ROOT:raise ValueError('scope')
    if os.environ.get('HOME')!=str(home/'.setup/os-home'):raise ValueError('scope')
    config=json.loads(guarded_read(home/'config.yaml',8*1024*1024,private=True))
    rules=json.loads(guarded_read(ROOT/'config/installer-access.json'))['components']
    catalog=json.loads(guarded_read(ROOT/'config/components/catalog.json',4*1024*1024))
    descriptor=next(row for row in catalog['components'] if row['id']==component)
    rule=rules.get(component,{})
    servers=['twilio-mcp'] if component=='twilio' else descriptor['servers']
    if not servers or any(s not in config.get('mcp_servers',{}) for s in servers):return False
    source=home/'python-runtimes/hermes-hud-agent/source'
    sys.path.insert(0,str(source))
    from tools import mcp_tool as core
    from tools import mcp_tool_config as native_config
    from tools.mcp_tool_discovery import discover_mcp_tools
    from tools.mcp_tool_lifecycle import shutdown_mcp_servers
    from tools.mcp_tool_schema import mcp_prefixed_tool_name
    from tools.registry import registry
    original_loader=native_config._load_mcp_config
    before=guarded_read(home/'config.yaml',8*1024*1024,private=True)
    if component=='zoom-rtms':
        # Native Hermes drops arbitrary parent env values. Scope the override
        # to this process's selected native registry snapshot, never config.yaml.
        def selected_config():
            snapshot=original_loader()
            if any(s not in snapshot for s in servers):raise ValueError('registration_changed')
            result={s:copy.deepcopy(snapshot[s]) for s in servers}
            for entry in result.values():entry.setdefault('env',{})['NETCLAW_MCP_DISCOVERY_ONLY']='1'
            return result
        native_config._load_mcp_config=selected_config
    try:
        names=set(discover_mcp_tools(allowed_mcp_names=servers))
        return (guarded_read(home/'config.yaml',8*1024*1024,private=True)==before and
            all(live_registered(s,rule.get('expected_tools',[]),names,core._servers,registry,mcp_prefixed_tool_name) for s in servers))
    finally:
        shutdown_mcp_servers()
        native_config._load_mcp_config=original_loader


if __name__=='__main__':
    try:ok=len(sys.argv)==2 and discover(sys.argv[1])
    except Exception:ok=False
    print(json.dumps({'state':'verified' if ok else 'unverified','code':'discovery_verified' if ok else 'discovery_unverified'}))
    raise SystemExit(0 if ok else 8)
