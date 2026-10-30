#!/usr/bin/env python3
"""Fixed pyATS list or one show-version observation. Raw results never escape."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]

def decoded(result):
    if result.is_error:return {}
    if isinstance(result.structured_content,dict):return result.structured_content
    for item in result.content:
        if getattr(item,'type',None)=='text' and len(item.text.encode())<=1024*1024:
            try:
                value=json.loads(item.text)
                if isinstance(value,dict):return value
            except ValueError:pass
    return {}

async def check(device=None):
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    spec=importlib.util.spec_from_file_location('launch',ROOT/'scripts/component-launch.py')
    launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)
    argv,env,cwd=launch.resolve('pyats','pyats-mcp',env=dict(os.environ),repo=ROOT)
    with open(os.devnull,'w') as errors:
        async with stdio_client(StdioServerParameters(command=argv[0],args=argv[1:],env=env,cwd=cwd),errlog=errors) as (read,write):
            async with ClientSession(read,write) as session:
                await session.initialize()
                return await observe_session(session,device)

async def observe_session(session,device=None):
    listed=decoded(await session.call_tool('pyats_list_devices',{}))
    devices=listed.get('devices',{}) if listed.get('status')=='completed' else {}
    if not isinstance(devices,dict):return {'devices':[]} if device is None else {'verified':False}
    names=sorted(n for n in devices if isinstance(n,str) and 0<len(n)<=128 and not any(c in n for c in '\r\n\0'))[:512]
    if device is None:return {'devices':names}
    if device not in names:return {'verified':False}
    result=decoded(await session.call_tool('pyats_run_show_command',{'device_name':device,'command':'show version','timeout':30,'retries':1}))
    return {'verified':result.get('status')=='completed' and result.get('device')==device and result.get('command')=='show version' and bool(result.get('output'))}

if __name__=='__main__':
    try:
        if len(sys.argv)>2:raise ValueError()
        result=asyncio.run(asyncio.wait_for(check(sys.argv[1] if len(sys.argv)==2 else None),45))
        print(json.dumps(result))
    except BaseException:
        print('{"verified":false}');raise SystemExit(2)
