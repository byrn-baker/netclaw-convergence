#!/usr/bin/env python3
"""Probe the selected native MCP registration with a private inert snapshot.

The real installation configuration and environment are never rewritten.
Only Zoom needs this child-only override; its native MCP transport otherwise
filters the discovery environment flag before launching the server.
"""
import copy
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import canonical,loads
from setup_state import guarded_read,guarded_write
from setup_comms_discovery import bounded_probe,new_request


def discover():
    home=Path(os.environ.get('OPENCLAW_STATE_DIR',''))
    if (not home.is_absolute() or ROOT!=home/'.setup/source' or ROOT.resolve()!=ROOT or
        os.environ.get('OPENCLAW_CONFIG_PATH')!=str(home/'openclaw.json')):raise ValueError('scope')
    path=home/'openclaw.json';before=guarded_read(path,8*1024*1024,private=True)
    config=loads(before,8*1024*1024);entry=copy.deepcopy(config['mcp']['servers']['zoom-rtms-mcp'])
    entry.setdefault('env',{})['NETCLAW_MCP_DISCOVERY_ONLY']='1'
    config['mcp']['servers']={'zoom-rtms-mcp':entry}
    folder=Path(tempfile.mkdtemp(prefix='comms-discovery-',dir=home/'.setup/tmp'))
    try:
        request=new_request(folder,home,'zoom-rtms-mcp')
        entry['env']['NETCLAW_MCP_DISCOVERY_LEASE']=str(request)
        snapshot=folder/'openclaw.json';guarded_write(snapshot,canonical(config),expected=None)
        output=bounded_probe([str(home/'.setup/prefix/bin/openclaw'),'mcp','probe','zoom-rtms-mcp','--json'],
            home=home,env={**os.environ,'OPENCLAW_CONFIG_PATH':str(snapshot)},request_path=request,
            server='zoom-rtms-mcp')
        if guarded_read(path,8*1024*1024,private=True)!=before:raise ValueError('configuration_changed')
        # Re-serialize only the native result; diagnostics never go to public
        # reports and the caller still validates a live selected tool catalog.
        value=json.loads(output)
        print(json.dumps(value))
    finally:
        # Keep the private lease on unknown cleanup; it is diagnostic evidence,
        # never an authorization to adopt or terminate another process later.
        try:clean=loads(guarded_read(folder/'cleanup.json',16384,private=True)).get('complete') is True
        except Exception:clean=False
        if clean:shutil.rmtree(folder)


if __name__=='__main__':
    try:
        if len(sys.argv)!=1:raise ValueError('arguments')
        discover()
    except Exception:
        print('Selected Comms discovery did not verify.',file=sys.stderr)
        raise SystemExit(8)
