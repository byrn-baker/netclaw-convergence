#!/usr/bin/env python3
"""Owned guards around pinned upstream tools; registration remains official MCP."""
import argparse
import asyncio
import functools
import hashlib
import importlib.util
import inspect
import json
import os
from pathlib import Path
import sys
import typing

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from pyats_testbeds import compose, catalog, environment_policy, TestbedError


def encoded(value):return json.dumps(value,ensure_ascii=True)


def rejected(code):
    return encoded({'status':'error','code':code,'activeUnchanged':True})


class ManagedTestbeds:
    def __init__(self,server,env=None):
        self.server=server;self.env=os.environ if env is None else env
        self.policy=environment_policy(self.env)
        self.lock=asyncio.Lock();self.used=set();self.candidates={};self.validated={}
        self.original={name:getattr(server,name) for name in dir(server) if name.startswith('pyats_') and inspect.iscoroutinefunction(getattr(server,name))}

    def fingerprint(self,name):
        raw=self.server._dynamic_testbeds.get(name).raw
        return hashlib.sha256(json.dumps(raw,sort_keys=True).encode()).hexdigest()

    def busy(self):
        runtime=getattr(self.server,'task_runtime',None)
        return self.lock.locked() or any(not job.done() for job in getattr(runtime,'jobs',{}).values())

    async def build(self,envelope,dry_run=False):
        if self.policy['mode']!='dynamic':raise TestbedError('select_dynamic_mode_and_sources_before_composition')
        selected=self.policy['sources'] if self.policy['mode']=='dynamic' else None
        candidate=compose(envelope,selected=selected)
        name=candidate['arguments']['name']
        if name in self.used or name in self.server._dynamic_testbeds.names():
            raise TestbedError('candidate_name_already_used')
        # Reserve before invoking upstream; interrupted/error candidates cannot
        # become a different inventory under a previously reviewed name.
        if not dry_run:self.used.add(name)
        result=json.loads(await self.original['pyats_testbed_build'](**candidate['arguments'],dry_run=dry_run))
        report=result.get('report',{})
        if result.get('status')!='completed' or report.get('devices_built')!=candidate['preview']['devices'] or report.get('devices_skipped'):
            raise TestbedError('upstream_build_incomplete')
        if not dry_run:
            self.candidates[name]={'fingerprint':self.fingerprint(name),'preview':candidate['preview']}
        return encoded({'status':'completed','stored':not dry_run,'active':self.server._dynamic_testbeds.active_name or ('static' if self.server.TESTBED_PATH else 'none'),
                        'preview':candidate['preview'],'next':'pyats_testbed_validate; then explicit pyats_testbed_activate',
                        'lifetime':'this MCP process only'})

    async def call(self,name,args):
        if name=='pyats_testbed_activate' and self.busy():return rejected('inventory_busy_retry_after_operations_complete')
        async with self.lock:
            try:
                if name=='netclaw_testbed_compose':return await self.build(args['envelope'])
                if name=='pyats_testbed_build':
                    defaults=inspect.signature(self.original[name]).parameters
                    for key,value in args.items():
                        if key in ('name','data','source','dry_run'):continue
                        if value!=defaults[key].default:raise TestbedError('use_managed_composition_envelope')
                    if args.get('source')!='inline' or not isinstance(args.get('data'),dict) or args['data'].get('name')!=args.get('name'):
                        raise TestbedError('use_inline_composition_envelope_or_netclaw_testbed_compose')
                    return await self.build(args['data'],args.get('dry_run',False))
                if name=='pyats_testbed_sources':
                    return encoded({'status':'completed','mode':self.policy['mode'],'selected':self.policy['sources'],
                        'active':self.server._dynamic_testbeds.active_name or ('static' if self.server.TESTBED_PATH else 'none'),
                        'sources':catalog(),'managedRoute':'existing source MCP or reviewed export → netclaw_testbed_compose',
                        'nativeFetch':'upstream capability; managed raw file/REST/native fetching is disabled',
                        'lifetime':'this MCP process only; restart requires rebuild, validate and activate'})
                if name=='pyats_testbed_source_inventories':
                    raise TestbedError('discover_scoped_inventories_with_existing_source_mcp')
                candidate_name=args.get('name')
                if name in ('pyats_testbed_validate','pyats_testbed_get','pyats_testbed_activate','pyats_testbed_delete') and candidate_name!='static':
                    candidate=self.candidates.get(candidate_name)
                    if not candidate or self.fingerprint(candidate_name)!=candidate['fingerprint']:
                        raise TestbedError('candidate_missing_or_changed_rebuild_required')
                if name=='pyats_testbed_activate':
                    if candidate_name=='static':
                        if self.policy['mode']=='dynamic' or not self.server.TESTBED_PATH:raise TestbedError('no_static_fallback_in_dynamic_mode')
                    elif self.validated.get(candidate_name)!=self.fingerprint(candidate_name):
                        raise TestbedError('candidate_requires_successful_schema_and_credential_validation')
                    elif self.server.tbb.unresolved_env(self.server._dynamic_testbeds.get(candidate_name).raw):
                        raise TestbedError('device_credentials_missing')
                if name=='pyats_testbed_delete' and candidate_name==self.server._dynamic_testbeds.active_name:
                    raise TestbedError('active_candidate_cannot_be_deleted')
                result=await self.original[name](**args)
                if name.startswith('pyats_testbed_'):
                    result=json.loads(result)
                    if name=='pyats_testbed_validate':
                        missing=result.get('credential_env',{}).get('unset_on_server',[])
                        valid=result.get('status')=='completed' and str(result.get('pyats_schema','')).startswith('ok (') and not missing
                        if valid and candidate_name!='static':self.validated[candidate_name]=self.fingerprint(candidate_name)
                        else:self.validated.pop(candidate_name,None)
                        safe={'status':'completed' if valid else 'invalid','name':candidate_name,
                              'pyats_schema':'valid' if str(result.get('pyats_schema','')).startswith('ok (') else 'invalid',
                              'missingCredentialReferences':missing,'devices':result.get('devices',0),
                              'reachability':'checked' if args.get('check_reachability') else 'not_checked',
                              'login':'not_checked','execution':'not_checked'}
                        if args.get('check_reachability'):safe['reachabilityResults']=result.get('reachability',{})
                        return encoded(safe)
                    if result.get('status')!='completed':raise TestbedError('upstream_testbed_operation_failed')
                    if name=='pyats_testbed_delete':
                        self.candidates.pop(candidate_name,None);self.validated.pop(candidate_name,None)
                    if name=='pyats_testbed_get' and candidate_name!='static':result['provenance']=self.candidates[candidate_name]['preview']['sources']
                    if name=='pyats_testbed_list':result['lifetime']='this MCP process only';result['mode']=self.policy['mode']
                    return encoded(result)
                return result
            except TestbedError as exc:return rejected(str(exc))
            except Exception:return rejected('managed_testbed_operation_failed')

    async def register(self):
        # Keep original tool schemas/annotations while replacing their execution
        # function. Resolved annotations avoid closure globals affecting schemas.
        for tool in await self.server.mcp.list_tools():
            original=self.original.get(tool.name)
            if original is None:raise RuntimeError('Unrecognized upstream tool contract')
            signature=inspect.signature(original);hints=typing.get_type_hints(original)
            signature=signature.replace(parameters=[p.replace(annotation=hints.get(p.name,p.annotation)) for p in signature.parameters.values()],return_annotation=hints.get('return',signature.return_annotation))
            def factory(tool_name,fn,sig):
                @functools.wraps(fn)
                async def wrapper(*args,**kwargs):
                    bound=sig.bind(*args,**kwargs);bound.apply_defaults()
                    return await self.call(tool_name,dict(bound.arguments))
                wrapper.__signature__=sig
                return wrapper
            self.server.mcp.remove_tool(tool.name)
            description=tool.description
            if tool.name=='pyats_testbed_build':description='Managed build: source=inline and data=reviewed composition envelope (same name). Prefer netclaw_testbed_compose. Raw native/file/REST fetch, arbitrary mappings, static merge and activate=True are refused.'
            if tool.name=='pyats_testbed_source_inventories':description='Managed source inventories are discovered with the selected source MCP. This tool returns guidance; it does not fetch native Itential inventory.'
            self.server.mcp.add_tool(factory(tool.name,original,signature),name=tool.name,description=description,annotations=tool.annotations)
        async def netclaw_testbed_compose(envelope:dict) -> str:
            """Build an immutable candidate from scoped source records; no activation or device I/O. Envelope schema1: name, sources[{kind,owner,scope,capturedAt,complete:true,total,records,mapping?,osMap?,defaults:{port:22}?,endpoints?}], credentials? (device env references only), maxAgeSeconds?. See docs/DYNAMIC-TESTBEDS.md. Review preview, call pyats_testbed_validate(check_reachability=false), then explicitly activate. Inventory lasts for this MCP process."""
            return await self.call('netclaw_testbed_compose',{'envelope':envelope})
        self.server.mcp.add_tool(netclaw_testbed_compose,annotations=self.server._STATEFUL)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--upstream',required=True,type=Path)
    args=parser.parse_args()
    choice=environment_policy(os.environ)
    os.environ['PYTHON_DOTENV_DISABLED']='1'
    if choice['mode']=='dynamic':
        os.environ.pop('PYATS_TESTBED_PATH',None);os.environ['PYATS_MCP_DYNAMIC_ONLY']='1'
    sys.path.insert(0,str(args.upstream.resolve().parent))
    spec=importlib.util.spec_from_file_location('netclaw_owned_pyats',args.upstream)
    server=importlib.util.module_from_spec(spec);sys.modules[spec.name]=server;spec.loader.exec_module(server)
    required=('pyats_testbed_build','pyats_testbed_validate','pyats_testbed_activate','pyats_testbed_sources')
    if any(not hasattr(server,name) for name in required):raise RuntimeError('Pinned dynamic upstream runtime required')
    managed=ManagedTestbeds(server);asyncio.run(managed.register())
    server.mcp.run(transport='streamable-http',host='127.0.0.1',port=int(os.environ['PYATS_MCP_HTTP_PORT']),json_response=True,stateless_http=True)


if __name__=='__main__':
    try:main()
    except Exception:
        print('Managed pyATS failed to start; verify the pinned runtime and selected testbed policy.',file=sys.stderr)
        raise SystemExit(1)
