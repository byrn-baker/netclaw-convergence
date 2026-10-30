#!/usr/bin/env python3
"""Preview/validate, or explicitly activate/list, within one owned MCP process."""
import argparse
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from pyats_testbeds import MAX_BYTES, compose
from setup_schema import loads
from setup_state import guarded_read


async def session(parts,env,cwd,envelope,activate=False):
    from mcp.client.client import Client
    from mcp.client.stdio import StdioServerParameters, stdio_client
    # No Tasks extension: await actual results, never a Task receipt. Capture
    # upstream diagnostics privately; return only bounded structured evidence.
    with tempfile.TemporaryFile(mode='w+') as errors:
        params=StdioServerParameters(command=parts[0],args=parts[1:],env=env,cwd=cwd)
        async with Client(stdio_client(params,errlog=errors),read_timeout_seconds=120) as client:
            names={tool.name for tool in (await client.list_tools()).tools}
            required={'netclaw_testbed_compose','pyats_testbed_validate','pyats_testbed_activate','pyats_list_devices'}
            if not required<=names:raise ValueError('managed_dynamic_tools_missing')
            async def call(name,args):
                response=await client.call_tool(name,args)
                if response.is_error:raise ValueError('mcp_tool_failed')
                raw=''.join(block.text for block in response.content if block.type=='text')
                if len(raw.encode())>MAX_BYTES:raise ValueError('mcp_result_too_large')
                value=json.loads(raw)
                if value.get('status')!='completed':raise ValueError(value.get('code','candidate_validation_failed'))
                return value
            built=await call('netclaw_testbed_compose',{'envelope':envelope})
            name=built['preview']['name']
            validated=await call('pyats_testbed_validate',{'name':name,'check_reachability':False})
            result={'preview':built['preview'],'validation':validated,'activation':'not_requested',
                    'lifetime':'process ended; rebuild/revalidate/reactivate for another session',
                    'deviceIO':'none'}
            if activate:
                active=await call('pyats_testbed_activate',{'name':name})
                devices=await call('pyats_list_devices',{})
                result['activation']=active;result['inventory']=devices
            return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path,help='Private reviewed composition JSON envelope')
    parser.add_argument('--runtime-env',type=Path,help='Selected installation .env; no values in arguments')
    parser.add_argument('--activate',action='store_true',help='Explicitly activate the validated candidate and list devices; no login or probe')
    args=parser.parse_args()
    try:
        spec=importlib.util.spec_from_file_location('testbed_launch',ROOT/'scripts/component-launch.py')
        launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)
        env=dict(os.environ)
        if args.runtime_env:env['NETCLAW_RUNTIME_ENV']=str(args.runtime_env.absolute())
        parts,env,cwd=launch.resolve('pyats',env=env)
        python=Path(env['PYATS_VENV'])/'bin/python'
        if not python.is_file():raise ValueError('pyats_runtime_missing')
        if Path(sys.prefix).resolve()!=python.parent.parent.resolve():
            os.execve(str(python),[str(python),str(Path(__file__).resolve()),*sys.argv[1:]],env)
        envelope=loads(guarded_read(args.input,MAX_BYTES,private=True),MAX_BYTES)
        compose(envelope)  # Refuse invalid input before starting the MCP runtime.
        result=asyncio.run(session(parts,env,str(cwd),envelope,args.activate))
        print(json.dumps(result,indent=2));return 0
    except Exception:
        print(json.dumps({'status':'error','code':'testbed_session_failed','action':'Check private envelope, selected policy, credential references and managed runtime. No device operation was requested.'}))
        return 1


if __name__=='__main__':raise SystemExit(main())
