#!/usr/bin/env python3
"""Fixed local MCP calls. No device targets, model turns or raw public output."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]


def call_for(component):
    if component=='subnet-calc':return 'subnet_calculator',{'cidr':'192.0.2.0/28'}
    if component=='anta':return 'anta_list_tests',{'category':'','keyword':'','limit':1}
    if component=='n2n':return 'n2n_status',{}
    raise ValueError('canary_not_supported')


def valid_result(component,value,identity,role='member'):
    if not isinstance(value,dict):return False
    if component=='subnet-calc':
        return value.get('network_address')=='192.0.2.0' and type(value.get('prefix_length')) is int and value['prefix_length']==28 and type(value.get('usable_hosts_count')) is int and value['usable_hosts_count']==14
    if component=='n2n':
        return role in ('member','border') and value.get('enabled') is True and value.get('identity')==identity and value.get('role')==role and value.get('ready') is True
    if component=='anta':
        total=value.get('total_in_catalogue');tests=value.get('tests')
        return (type(total) is int and total>0 and type(value.get('matched')) is int and value['matched']==total
                and type(value.get('returned')) is int and value['returned']==1 and value.get('truncated') is (total>1)
                and isinstance(tests,list) and len(tests)==1 and isinstance(tests[0],dict)
                and all(isinstance(tests[0].get(key),str) and 0<len(tests[0][key])<=4096 for key in ('name','category','description')))
    return False


def result_values(result):
    if result.is_error:return []
    values=[result.structured_content] if isinstance(result.structured_content,dict) else []
    for block in result.content:
        if getattr(block,'type',None)=='text' and len(block.text.encode())<=65536:
            try:values.append(json.loads(block.text))
            except ValueError:pass
    return values


def launch_parameters(component,environment,source=ROOT):
    call_for(component)
    kind=environment.get('NETCLAW_RUNTIME')
    if kind not in ('openclaw','hermes'):raise ValueError('canary_scope_invalid')
    home=Path(environment.get('HERMES_HOME' if kind=='hermes' else 'OPENCLAW_STATE_DIR',''))
    if not home.is_absolute() or source!=home/'.setup/source' or source.resolve()!=source:raise ValueError('canary_scope_invalid')
    # The local catalog/calculator needs no credential. In particular, prevent
    # component-launch from loading .env or accepting a script override in it.
    allowed=('HOME','PATH','TMPDIR','LANG','LC_ALL','PYTHONNOUSERSITE','NETCLAW_RUNTIME',
             'OPENCLAW_STATE_DIR','OPENCLAW_CONFIG_PATH','HERMES_HOME',
             'XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_DATA_HOME','XDG_STATE_HOME')
    env={key:environment[key] for key in allowed if key in environment}
    env.update(NETCLAW_RUNTIME_ROOT=str(home/'python-runtimes'),NETCLAW_RUNTIME_ENV='/dev/null',NETCLAW_FEDERATION_SCOPED='1')
    if env.get('HOME')!=str(home/'.setup/os-home'):raise ValueError('canary_scope_invalid')
    # Use the same private readers as setup; no neighbor record or executable
    # symlink can provide a successful result on behalf of this installation.
    sys.path.insert(0,str(ROOT/'scripts/lib'))
    from setup_state import guarded_read
    identity=json.loads(guarded_read(home/'netclaw-hud/installation.json',8192,private=True))['installationId']
    if not isinstance(identity,str) or not identity:raise ValueError('canary_identity_invalid')
    if component=='n2n':
        role=environment.get('N2N_ROLE')
        if role not in ('member','border'):raise ValueError('canary_not_supported')
        env.update(N2N_ROLE=role,NETCLAW_INSTALLATION_ID=identity,NETCLAW_SETUP_STATUS_ONLY='1')
    record=Path(guarded_read(home/'python-runtimes/records'/component,8192,private=True).decode().strip())
    if not record.is_absolute() or not record.is_relative_to(home) or not record.resolve().is_relative_to(home) or not os.access(record,os.X_OK):raise ValueError('canary_runtime_invalid')
    if component=='anta':
        script=source/'mcp-servers/anta-mcp/server.py'
        guarded_read(script,1024*1024)
        return [str(record),'-u',str(script)],env,str(source),identity
    spec=importlib.util.spec_from_file_location('launch',source/'scripts/component-launch.py')
    launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)
    argv,env,cwd=launch.resolve(component,component+'-mcp',env=env,repo=source)
    if argv[0]!=str(record):raise ValueError('canary_runtime_changed')
    return argv,env,cwd,identity


async def canary(component='subnet-calc'):
    name,arguments=call_for(component)
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    argv,env,cwd,identity=launch_parameters(component,dict(os.environ))
    with open(os.devnull,'w') as errors:
        async with stdio_client(StdioServerParameters(command=argv[0],args=argv[1:],env=env,cwd=cwd),errlog=errors) as (read,write):
            async with ClientSession(read,write) as session:
                await session.initialize()
                result=await session.call_tool(name,arguments)
                return any(valid_result(component,value,identity,env.get('N2N_ROLE','member')) for value in result_values(result))


if __name__=='__main__':
    try:verified=asyncio.run(asyncio.wait_for(canary(sys.argv[1] if len(sys.argv)==2 else 'subnet-calc'),25))
    except BaseException:verified=False
    print(json.dumps({'state':'verified' if verified else 'unverified','code':'canary_verified' if verified else 'canary_unverified'}))
    sys.exit(0 if verified else 1)
